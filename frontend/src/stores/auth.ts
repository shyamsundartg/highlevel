import { defineStore } from "pinia";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { ref } from "vue";
import { auth } from "../lib/firebase";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const ready = ref(false);

  function init(): Promise<void> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (nextUser) => {
        user.value = nextUser;
        ready.value = true;
        resolve();
      });
    });
  }

  async function signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function logout(): Promise<void> {
    await signOut(auth);
  }

  return { user, ready, init, signIn, signUp, logout };
});
