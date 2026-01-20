import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { type ReactElement, type ReactNode } from "react";

type WrapperProps = {
  children: ReactNode;
};

// Custom wrapper that can be extended with providers
function Wrapper({ children }: WrapperProps) {
  return <>{children}</>;
}

// Custom render function that wraps components with necessary providers
function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";

// Override the render function
export { render };
