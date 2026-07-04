import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import { collections } from "../../types/collections";
import { FileDoc } from "../../types/firestore";
import { fileIdToPath, inferLanguage, pathToFileId } from "../../utils/filePath";
import { touchProject } from "./projects";

export interface SerializedFileMeta {
  fileId: string;
  path: string;
  language: string;
  sizeBytes: number;
  updatedAt: number;
}

export interface SerializedFile extends SerializedFileMeta {
  content: string;
}

function serializeFileMeta(fileId: string, doc: FileDoc): SerializedFileMeta {
  return {
    fileId,
    path: doc.path,
    language: doc.language,
    sizeBytes: doc.sizeBytes,
    updatedAt: doc.updatedAt.toMillis(),
  };
}

export async function listFiles(projectId: string): Promise<SerializedFileMeta[]> {
  const snapshot = await db.collection(collections.projectFiles(projectId)).get();
  return snapshot.docs.map((doc) =>
    serializeFileMeta(doc.id, doc.data() as FileDoc),
  );
}

export async function getFile(
  projectId: string,
  fileId: string,
): Promise<SerializedFile | null> {
  const path = fileIdToPath(fileId);
  const snapshot = await db.doc(collections.projectFile(projectId, fileId)).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as FileDoc;
  return {
    ...serializeFileMeta(fileId, data),
    path,
    content: data.content,
  };
}

export async function saveFile(
  projectId: string,
  fileId: string,
  content: string,
): Promise<SerializedFile> {
  const path = fileIdToPath(fileId);
  const language = inferLanguage(path);
  const now = Timestamp.now();
  const sizeBytes = Buffer.byteLength(content, "utf8");

  const doc: FileDoc = {
    path,
    content,
    language,
    sizeBytes,
    updatedAt: now,
  };

  await db.doc(collections.projectFile(projectId, fileId)).set(doc);
  await touchProject(projectId);

  return {
    fileId,
    path,
    language,
    sizeBytes,
    updatedAt: now.toMillis(),
    content,
  };
}

export { pathToFileId };
