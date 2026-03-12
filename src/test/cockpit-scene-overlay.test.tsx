import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CockpitSceneOverlay } from "@/features/cockpit/components/CockpitSceneOverlay";

describe("CockpitSceneOverlay", () => {
  it("renders a loading state", () => {
    render(<CockpitSceneOverlay companyName="Acme Delegation" status="loading" />);

    expect(screen.getByText("Loading Scene")).toBeInTheDocument();
    expect(
      screen.getByText(/Booting the Acme Delegation office/i),
    ).toBeInTheDocument();
  });

  it("renders an unsupported message", () => {
    render(
      <CockpitSceneOverlay
        companyName="Acme Delegation"
        status="unsupported"
        errorMessage="WebGPU is not available."
      />,
    );

    expect(screen.getByText("WebGPU Unsupported")).toBeInTheDocument();
    expect(screen.getByText("WebGPU is not available.")).toBeInTheDocument();
  });
});
