import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/utils/render";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  describe("rendering", () => {
    it("should render button with text", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
    });

    it("should render with default variant and size", () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-variant", "default");
      expect(button).toHaveAttribute("data-size", "default");
    });

    it("should render with custom variant", () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-variant", "destructive");
    });
  });

  describe("variants", () => {
    it("should apply outline variant styles", () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-variant", "outline");
    });

    it("should apply ghost variant styles", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-variant", "ghost");
    });
  });

  describe("sizes", () => {
    it("should apply sm size", () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-size", "sm");
    });

    it("should apply lg size", () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-size", "lg");
    });

    it("should apply icon size", () => {
      render(<Button size="icon">🔍</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-size", "icon");
    });
  });

  describe("interactions", () => {
    it("should handle click events", async () => {
      const user = userEvent.setup();
      let clicked = false;
      const handleClick = () => { clicked = true; };

      render(<Button onClick={handleClick}>Click</Button>);
      await user.click(screen.getByRole("button"));

      expect(clicked).toBe(true);
    });

    it("should not fire click when disabled", async () => {
      const user = userEvent.setup();
      let clicked = false;
      const handleClick = () => { clicked = true; };

      render(<Button disabled onClick={handleClick}>Disabled</Button>);
      await user.click(screen.getByRole("button"));

      expect(clicked).toBe(false);
    });
  });

  describe("asChild prop", () => {
    it("should render as child element when asChild is true", () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );

      const link = screen.getByRole("link", { name: /link button/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/test");
    });
  });

  describe("accessibility", () => {
    it("should be focusable", async () => {
      const user = userEvent.setup();
      render(<Button>Focus me</Button>);

      await user.tab();

      expect(screen.getByRole("button")).toHaveFocus();
    });

    it("should have data-slot attribute", () => {
      render(<Button>With slot</Button>);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("data-slot", "button");
    });
  });
});
