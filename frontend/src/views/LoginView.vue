<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Loader2 } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthMode = "signin" | "signup";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const mode = ref<AuthMode>("signin");
const email = ref("");
const password = ref("");
const error = ref<string | null>(null);
const loading = ref(false);

const isSignUp = computed(() => mode.value === "signup");

watch(mode, () => {
  error.value = null;
});

async function submit(): Promise<void> {
  error.value = null;
  loading.value = true;
  try {
    if (isSignUp.value) {
      await auth.signUp(email.value, password.value);
    } else {
      await auth.signIn(email.value, password.value);
    }
    const redirect = safeRedirectPath(
      typeof route.query.redirect === "string" ? route.query.redirect : undefined,
    );
    await router.push(redirect);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Authentication failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-bg" aria-hidden="true">
      <div class="auth-orb auth-orb-a" />
      <div class="auth-orb auth-orb-b" />
      <div class="auth-orb auth-orb-c" />
    </div>

    <main class="auth-shell">
      <Card :class="cn('auth-card border-0 shadow-none')">
        <CardHeader class="auth-card-header space-y-4 pb-2 text-center">
          <div class="auth-logo">G</div>

          <Transition name="title-fade" mode="out-in">
            <div :key="mode" class="space-y-1">
              <CardTitle class="auth-title">
                {{ isSignUp ? "Create your account" : "Welcome back" }}
              </CardTitle>
              <CardDescription class="auth-description">
                {{
                  isSignUp
                    ? "Start building HighLevel apps with AI"
                    : "Sign in to continue to Genesis"
                }}
              </CardDescription>
            </div>
          </Transition>
        </CardHeader>

        <CardContent class="space-y-5 px-6">
          <Tabs v-model="mode" class="w-full">
            <TabsList
              class="auth-tabs-list grid h-11 w-full grid-cols-2 rounded-xl p-1"
            >
              <TabsTrigger
                value="signin"
                class="auth-tab-trigger rounded-lg text-sm font-medium"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                class="auth-tab-trigger rounded-lg text-sm font-medium"
              >
                Sign up
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form class="space-y-4" @submit.prevent="submit">
            <Transition name="field-rise" appear>
              <div class="space-y-3.5">
                <div class="space-y-1.5">
                  <Label for="email" class="auth-label">Email</Label>
                  <Input
                    id="email"
                    v-model="email"
                    type="email"
                    autocomplete="email"
                    placeholder="name@example.com"
                    class="auth-input h-11 rounded-xl bg-white/90 text-base"
                    required
                  />
                </div>
                <div class="space-y-1.5">
                  <Label for="password" class="auth-label">Password</Label>
                  <Input
                    id="password"
                    v-model="password"
                    type="password"
                    :autocomplete="isSignUp ? 'new-password' : 'current-password'"
                    placeholder="••••••••"
                    class="auth-input h-11 rounded-xl bg-white/90 text-base"
                    required
                  />
                </div>
              </div>
            </Transition>

            <Transition name="error-pop">
              <Alert
                v-if="error"
                variant="destructive"
                class="auth-alert rounded-xl border-red-200/80 bg-red-50 text-red-700"
              >
                <AlertDescription>{{ error }}</AlertDescription>
              </Alert>
            </Transition>

            <Button
              type="submit"
              :disabled="loading"
              :class="cn(
                'auth-submit h-11 w-full rounded-full text-base font-medium shadow-none',
                'bg-[#0071e3] text-white hover:bg-[#0077ed] active:scale-[0.98]',
              )"
            >
              <Loader2 v-if="loading" class="mr-2 size-4 animate-spin" />
              <Transition name="label-swap" mode="out-in">
                <span :key="loading ? 'loading' : mode">
                  {{
                    loading
                      ? "Please wait…"
                      : isSignUp
                        ? "Create account"
                        : "Sign in"
                  }}
                </span>
              </Transition>
            </Button>
          </form>
        </CardContent>

        
      </Card>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  --auth-bg: #f5f5f7;
  --auth-text: #1d1d1f;
  --auth-muted: #6e6e73;
  --auth-border: rgba(0, 0, 0, 0.08);

  position: relative;
  min-height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    "Segoe UI", sans-serif;
  color: var(--auth-text);
  background: var(--auth-bg);
}

.auth-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.auth-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
  animation: float 18s ease-in-out infinite;
}

.auth-orb-a {
  width: 420px;
  height: 420px;
  top: -120px;
  right: -80px;
  background: radial-gradient(circle, #c8d8ff 0%, transparent 70%);
}

.auth-orb-b {
  width: 360px;
  height: 360px;
  bottom: -100px;
  left: -60px;
  background: radial-gradient(circle, #e8d4ff 0%, transparent 70%);
  animation-delay: -6s;
}

.auth-orb-c {
  width: 280px;
  height: 280px;
  top: 40%;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, #d4f0ff 0%, transparent 70%);
  animation-delay: -12s;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-24px) scale(1.04);
  }
}

.auth-shell {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  border-radius: 28px !important;
  border: 1px solid var(--auth-border) !important;
  background: rgba(255, 255, 255, 0.72) !important;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.08) !important;
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  animation: card-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  color: var(--auth-text);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.auth-card-header {
  padding-top: 2.5rem;
}

.auth-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: 0 auto;
  border-radius: 14px;
  background: linear-gradient(145deg, #1d1d1f 0%, #3a3a3c 100%);
  color: #fff;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.auth-title {
  font-size: 1.625rem !important;
  font-weight: 600 !important;
  letter-spacing: -0.03em;
  color: var(--auth-text) !important;
}

.auth-description {
  font-size: 0.9375rem !important;
  color: var(--auth-muted) !important;
}

.auth-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--auth-muted);
}

.auth-footnote {
  color: var(--auth-muted);
}

/* ShadCN Tabs — Apple segmented control */
.auth-tabs-list {
  background: rgba(0, 0, 0, 0.05) !important;
  height: 2.75rem !important;
}

.auth-page :deep(.auth-tab-trigger) {
  color: var(--auth-muted);
  transition: color 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.auth-page :deep(.auth-tab-trigger[data-state="active"]) {
  color: var(--auth-text) !important;
  background: #fff !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04) !important;
}

.auth-page :deep(.auth-tab-trigger::after) {
  display: none;
}

.auth-page :deep(.auth-input) {
  border-color: var(--auth-border);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.auth-page :deep(.auth-input:focus-visible) {
  border-color: #0071e3;
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.15);
}

.auth-page :deep(.auth-submit:disabled) {
  opacity: 0.65;
}

/* Vue transitions */
.title-fade-enter-active,
.title-fade-leave-active {
  transition: opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.title-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.title-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.field-rise-enter-active {
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s;
}

.field-rise-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.error-pop-enter-active,
.error-pop-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.error-pop-enter-from,
.error-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.label-swap-enter-active,
.label-swap-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.label-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.label-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
