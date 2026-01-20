import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@/test/utils/render";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import {
  createMockSSEResponse,
  createSampleSSEEvents,
} from "@/test/utils/sse-helpers";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Home Page", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("workflow navigation", () => {
    it("should render the documents step by default", () => {
      render(<Home />);

      expect(screen.getByText(/Document Set/i)).toBeInTheDocument();
      expect(screen.getByText(/Upload PDF, DOCX, TXT/i)).toBeInTheDocument();
    });

    it("should navigate to configure step when Continue is clicked with documents", async () => {
      const user = userEvent.setup();
      render(<Home />);

      // Add some document text
      const textarea = screen.getByPlaceholderText(/paste document text/i);
      await user.type(textarea, "Some document content");

      // Click continue
      const continueButton = screen.getByRole("button", { name: /continue/i });
      await user.click(continueButton);

      // Should now be on configure step
      await waitFor(() => {
        expect(screen.getByText(/Analysis Configuration/i)).toBeInTheDocument();
      });
    });

    it("should allow navigation back from configure step", async () => {
      const user = userEvent.setup();
      render(<Home />);

      // Navigate to configure
      const textarea = screen.getByPlaceholderText(/paste document text/i);
      await user.type(textarea, "Document content");
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Wait for configure step
      await waitFor(() => {
        expect(screen.getByText(/Analysis Configuration/i)).toBeInTheDocument();
      });

      // Navigate back
      const backButton = screen.getByRole("button", { name: /back/i });
      await user.click(backButton);

      // Should be back on documents step
      await waitFor(() => {
        expect(screen.getByText(/Document Set/i)).toBeInTheDocument();
      });
    });
  });

  describe("document management", () => {
    it("should add a new document when Add document is clicked", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const addButton = screen.getByRole("button", { name: /add document/i });
      await user.click(addButton);

      // Should have two document sections now
      const docInputs = screen.getAllByPlaceholderText(/paste document text/i);
      expect(docInputs.length).toBe(2);
    });

    it("should remove a document when Remove is clicked", async () => {
      const user = userEvent.setup();
      render(<Home />);

      // Add a document first
      await user.click(screen.getByRole("button", { name: /add document/i }));

      // Now we should have 2 documents
      let textareas = screen.getAllByPlaceholderText(/paste document text/i);
      expect(textareas.length).toBe(2);

      // Remove button should appear on hover - we need to interact with the doc
      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      await user.click(removeButtons[0]);

      // Should be back to 1 document
      textareas = screen.getAllByPlaceholderText(/paste document text/i);
      expect(textareas.length).toBe(1);
    });

    it("should update document text when typing", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const textarea = screen.getByPlaceholderText(/paste document text/i);
      await user.type(textarea, "Test content");

      expect(textarea).toHaveValue("Test content");
    });
  });

  describe("file upload", () => {
    it("should have file input for each document", () => {
      render(<Home />);

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it("should accept file types for PDF, DOCX, and TXT", () => {
      render(<Home />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput.accept).toContain(".pdf");
      expect(fileInput.accept).toContain(".docx");
      expect(fileInput.accept).toContain(".txt");
    });
  });

  describe("configuration step", () => {
    it("should show question textarea", async () => {
      const user = userEvent.setup();
      render(<Home />);

      // Navigate to configure
      await user.type(screen.getByPlaceholderText(/paste document text/i), "Content");
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        const questionInput = screen.getByPlaceholderText(/ask a targeted question/i);
        expect(questionInput).toBeInTheDocument();
      });
    });

    it("should show mode selection tabs", async () => {
      const user = userEvent.setup();
      render(<Home />);

      // Navigate to configure
      await user.type(screen.getByPlaceholderText(/paste document text/i), "Content");
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /base/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /retrieval/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /rlm/i })).toBeInTheDocument();
      });
    });

    it("should show advanced parameters based on selected mode", async () => {
      const user = userEvent.setup();
      render(<Home />);

      // Navigate to configure
      await user.type(screen.getByPlaceholderText(/paste document text/i), "Content");
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Default mode is RLM - should show Chunk size and Max subcalls, but not Top K
      await waitFor(() => {
        expect(screen.getByText(/Chunk size/i)).toBeInTheDocument();
        expect(screen.getByText(/Max subcalls/i)).toBeInTheDocument();
        expect(screen.queryByText(/Top K/i)).not.toBeInTheDocument();
      });

      // Switch to retrieval mode - should show Chunk size and Top K, but not Max subcalls
      await user.click(screen.getByRole("tab", { name: /retrieval/i }));
      await waitFor(() => {
        expect(screen.getByText(/Chunk size/i)).toBeInTheDocument();
        expect(screen.getByText(/Top K/i)).toBeInTheDocument();
        expect(screen.queryByText(/Max subcalls/i)).not.toBeInTheDocument();
      });

      // Switch to base mode - should show no advanced parameters
      await user.click(screen.getByRole("tab", { name: /base/i }));
      await waitFor(() => {
        expect(screen.queryByText(/Chunk size/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Advanced Parameters/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("analysis execution", () => {
    it("should show loading state during analysis", async () => {
      const user = userEvent.setup();

      // Mock SSE response
      mockFetch.mockResolvedValueOnce(
        createMockSSEResponse(createSampleSSEEvents("base"))
      );

      render(<Home />);

      // Navigate to configure
      await user.type(screen.getByPlaceholderText(/paste document text/i), "Test content");
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /run analysis/i })).toBeInTheDocument();
      });

      // Click run analysis
      await user.click(screen.getByRole("button", { name: /run analysis/i }));

      // Should transition to results and show terminal
      await waitFor(() => {
        expect(screen.getByText(/Analysis Results/i)).toBeInTheDocument();
      });
    });
  });

  describe("step indicator", () => {
    it("should show all three steps", () => {
      render(<Home />);

      expect(screen.getByText("Documents")).toBeInTheDocument();
      expect(screen.getByText("Configure")).toBeInTheDocument();
      expect(screen.getByText("Results")).toBeInTheDocument();
    });

    it("should highlight current step", () => {
      render(<Home />);

      // Documents step should be active (has the step number visible)
      const documentsButton = screen.getByRole("button", { name: /1.*documents/i });
      expect(documentsButton).toBeInTheDocument();
    });
  });

  describe("character counter", () => {
    it("should display total character count", async () => {
      const user = userEvent.setup();
      render(<Home />);

      await user.type(screen.getByPlaceholderText(/paste document text/i), "12345");

      expect(screen.getByText(/5.*chars/i)).toBeInTheDocument();
    });
  });
});
