import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";

// Set up environment variables for tests
vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com");
vi.stubEnv("AZURE_OPENAI_API_KEY", "test-api-key");
vi.stubEnv("AZURE_OPENAI_API_VERSION", "2025-03-01-preview");
vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-4");
vi.stubEnv("AZURE_OPENAI_DEPLOYMENT_ROOT", "gpt-4");
vi.stubEnv("AZURE_OPENAI_DEPLOYMENT_SUB", "gpt-5-nano");

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

// Reset handlers and cleanup DOM after each test
afterEach(() => {
  server.resetHandlers();
  cleanup();
});

// Close MSW server after all tests
afterAll(() => {
  server.close();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
