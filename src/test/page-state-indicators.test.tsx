/**
 * Tests for the reusable loading, empty, and error state components.
 *
 * VAL-POLISH-001: Core pages show intentional loading, empty, and recoverable
 * error states rather than blank or broken screens.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Bot } from "lucide-react";

import {
  PageLoadingState,
  PageEmptyState,
  PageErrorState,
} from "@/components/PageStateIndicators";

describe("PageLoadingState", () => {
  it("renders with default label and skeleton rows", () => {
    render(<PageLoadingState />);
    expect(screen.getByTestId("page-loading-state")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<PageLoadingState label="Loading agents…" />);
    expect(screen.getByText("Loading agents…")).toBeInTheDocument();
  });

  it("renders the specified number of skeleton rows", () => {
    const { container } = render(<PageLoadingState rows={5} />);
    // Each skeleton row is a Card element
    const cards = container.querySelectorAll("[class*='border-white/10']");
    expect(cards.length).toBe(5);
  });
});

describe("PageEmptyState", () => {
  it("renders title and description", () => {
    render(
      <PageEmptyState
        title="No agents yet"
        description="Create your first agent."
      />,
    );
    expect(screen.getByTestId("page-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first agent.")).toBeInTheDocument();
  });

  it("renders custom icon", () => {
    const { container } = render(
      <PageEmptyState icon={Bot} title="No bots" />,
    );
    const svg = container.querySelector("svg.lucide-bot");
    expect(svg).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(
      <MemoryRouter>
        <PageEmptyState
          title="Nothing here"
          action={<button>Create</button>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<PageEmptyState title="Empty" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
    // No description paragraph
    const p = screen.queryByText(/./);
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });
});

describe("PageErrorState", () => {
  it("renders with default error message", () => {
    render(<PageErrorState />);
    expect(screen.getByTestId("page-error-state")).toBeInTheDocument();
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    expect(
      screen.getByText("Something went wrong while loading this page."),
    ).toBeInTheDocument();
  });

  it("renders with custom error message", () => {
    render(<PageErrorState message="Network error occurred" />);
    expect(screen.getByText("Network error occurred")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const handleRetry = vi.fn();
    render(<PageErrorState onRetry={handleRetry} />);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it("does not render retry button when onRetry is omitted", () => {
    render(<PageErrorState />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });
});
