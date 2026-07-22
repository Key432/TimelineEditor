import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimelineFilterPanel } from "@/features/timeline-items/timeline-filter-panel";
import { DEFAULT_TIMELINE_FILTERS } from "@/features/timeline-items/timeline-filters";

describe("TimelineFilterPanel", () => {
  it("keeps IME composition local until Japanese input is committed", () => {
    const onChange = vi.fn();
    render(
      <TimelineFilterPanel
        filters={DEFAULT_TIMELINE_FILTERS}
        itemTypes={[]}
        onChange={onChange}
      />,
    );

    const query = screen.getByLabelText("タイムライン内検索");
    fireEvent.compositionStart(query);
    fireEvent.change(query, { target: { value: "k" } });
    expect(query).toHaveValue("k");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(query, { target: { value: "記" } });
    fireEvent.compositionEnd(query, { data: "記" });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_TIMELINE_FILTERS,
      query: "記",
    });
  });
});
