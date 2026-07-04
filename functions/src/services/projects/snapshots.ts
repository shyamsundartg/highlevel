import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { collections } from "../../types/collections";
import { FileDoc, SnapshotDoc, SnapshotFileEntry } from "../../types/firestore";
import { pathToFileId } from "../../utils/filePath";
import { touchProject } from "./projects";

export interface SerializedSnapshot {
  id: string;
  label: string;
  generationId: string;
  fileCount: number;
  createdAt: number;
}

function serializeSnapshot(id: string, doc: SnapshotDoc): SerializedSnapshot {
  return {
    id,
    label: doc.label,
    generationId: doc.generationId,
    fileCount: doc.fileCount,
    createdAt: doc.createdAt.toMillis(),
  };
}

export async function createSnapshot(
  projectId: string,
  generationId: string,
  files: Record<string, SnapshotFileEntry>,
  label: string,
): Promise<SerializedSnapshot> {
  const now = Timestamp.now();
  const ref = db.collection(collections.projectSnapshots(projectId)).doc();
  const doc: SnapshotDoc = {
    createdAt: now,
    label,
    generationId,
    fileCount: Object.keys(files).length,
    files,
  };

  await ref.set(doc);
  await touchProject(projectId);
  return serializeSnapshot(ref.id, doc);
}

export async function listSnapshots(
  projectId: string,
): Promise<SerializedSnapshot[]> {
  const snapshot = await db
    .collection(collections.projectSnapshots(projectId))
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    serializeSnapshot(doc.id, doc.data() as SnapshotDoc),
  );
}

export async function restoreSnapshot(
  projectId: string,
  snapshotId: string,
): Promise<{ restoredFiles: number }> {
  const ref = db.doc(collections.projectSnapshot(projectId, snapshotId));
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const data = snapshot.data() as SnapshotDoc;
  const batch = db.batch();
  const now = Timestamp.now();

  for (const [path, entry] of Object.entries(data.files)) {
    const fileId = pathToFileId(path);
    const fileDoc: FileDoc = {
      path,
      content: entry.content,
      language: entry.language,
      sizeBytes: Buffer.byteLength(entry.content, "utf8"),
      updatedAt: now,
    };
    batch.set(db.doc(collections.projectFile(projectId, fileId)), fileDoc);
  }

  await batch.commit();
  await touchProject(projectId);
  return { restoredFiles: Object.keys(data.files).length };
}
