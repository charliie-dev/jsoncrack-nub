import { describe, expect, it } from "vitest";
import type { LayoutRoot } from "../utils/alignEdgesToRows";
import { alignEdgesToRows, buildPortOffsetMap } from "../utils/alignEdgesToRows";

/** A source node whose top edge sits at y=100, with one edge leaving port `p`. */
const layoutWith = (section: NonNullable<LayoutRoot["edges"]>[number]["sections"]): LayoutRoot => ({
  children: [
    { id: "src", y: 100 },
    { id: "dst", y: 400 },
  ],
  edges: [{ properties: { from: "src", fromPort: "p" }, sections: section }],
});

const offsets = new Map([["p", 43]]);

describe("buildPortOffsetMap", () => {
  it("indexes every port's row offset by port id", () => {
    const map = buildPortOffsetMap([
      {
        id: "1",
        text: [],
        width: 10,
        height: 10,
        ports: [
          { id: "port-1-0-0", width: 1, height: 1, side: "EAST", y: 43 },
          { id: "port-1-2-0", width: 1, height: 1, side: "EAST", y: 95 },
        ],
      },
      { id: "2", text: [], width: 10, height: 10 },
    ]);

    expect(map.get("port-1-0-0")).toBe(43);
    expect(map.get("port-1-2-0")).toBe(95);
    expect(map.size).toBe(2);
  });
});

describe("alignEdgesToRows entering the target", () => {
  /** Source top at y=100 so a port offset of 43 puts the row at y=143. */
  const withTarget = (targetY: number, targetHeight: number): LayoutRoot => ({
    children: [
      { id: "src", y: 100, height: 200 },
      { id: "dst", y: targetY, height: targetHeight },
    ],
    edges: [
      {
        properties: { from: "src", to: "dst", fromPort: "p" },
        sections: [
          {
            startPoint: { x: 200, y: 160 },
            bendPoints: [
              { x: 250, y: 160 },
              { x: 250, y: 150 },
            ],
            endPoint: { x: 300, y: 150 },
          },
        ],
      },
    ],
  });

  it("goes straight in when the row already points at the target's side", () => {
    const layout = withTarget(100, 100);

    alignEdgesToRows(layout, offsets);
    const [section] = layout.edges![0].sections!;

    expect(section.startPoint).toEqual({ x: 200, y: 143 });
    expect(section.endPoint).toEqual({ x: 300, y: 143 });
    expect(section.bendPoints).toBeUndefined();
  });

  it("keeps the turn when the row would arrive on the target's corner", () => {
    // Eight pixels of inset, so a target spanning 138..238 only accepts 146 downwards.
    const layout = withTarget(138, 100);

    alignEdgesToRows(layout, offsets);
    const [section] = layout.edges![0].sections!;

    expect(section.startPoint.y).toBe(143);
    expect(section.endPoint.y).toBe(150);
    expect(section.bendPoints).toHaveLength(2);
  });

  it("keeps a turn long enough to read, even into a target that could be entered", () => {
    const layout: LayoutRoot = {
      children: [
        { id: "src", y: 100, height: 200 },
        // Tall enough that the row at 143 sits well inside it.
        { id: "dst", y: 100, height: 300 },
      ],
      edges: [
        {
          properties: { from: "src", to: "dst", fromPort: "p" },
          sections: [
            {
              startPoint: { x: 200, y: 160 },
              bendPoints: [
                { x: 250, y: 160 },
                { x: 250, y: 300 },
              ],
              endPoint: { x: 300, y: 300 },
            },
          ],
        },
      ],
    };

    alignEdgesToRows(layout, offsets);
    const [section] = layout.edges![0].sections!;

    expect(section.startPoint.y).toBe(143);
    expect(section.endPoint.y).toBe(300);
    expect(section.bendPoints).toEqual([
      { x: 250, y: 143 },
      { x: 250, y: 300 },
    ]);
  });

  it("keeps the turn when the target is somewhere else entirely", () => {
    const layout = withTarget(400, 100);

    alignEdgesToRows(layout, offsets);
    const [section] = layout.edges![0].sections!;

    expect(section.startPoint.y).toBe(143);
    expect(section.bendPoints).toHaveLength(2);
  });

  it("leaves a target too short to be entered cleanly to the turn", () => {
    const layout = withTarget(120, 20);

    alignEdgesToRows(layout, offsets);

    expect(layout.edges![0].sections![0].bendPoints).toHaveLength(2);
  });
});

describe("alignEdgesToRows", () => {
  it("slides a horizontal stub and its bend onto the row, leaving the rest alone", () => {
    const layout = layoutWith([
      {
        startPoint: { x: 200, y: 154 },
        bendPoints: [
          { x: 230, y: 154 },
          { x: 230, y: 430 },
        ],
        endPoint: { x: 300, y: 430 },
      },
    ]);

    alignEdgesToRows(layout, offsets);
    const [section] = layout.edges![0].sections!;

    expect(section.startPoint).toEqual({ x: 200, y: 143 });
    expect(section.bendPoints).toEqual([
      { x: 230, y: 143 },
      { x: 230, y: 430 },
    ]);
    expect(section.endPoint).toEqual({ x: 300, y: 430 });
  });

  it("breaks a straight edge with a jog halfway across, so it stays orthogonal", () => {
    const layout = layoutWith([{ startPoint: { x: 200, y: 154 }, endPoint: { x: 300, y: 154 } }]);

    alignEdgesToRows(layout, offsets);
    const [section] = layout.edges![0].sections!;

    expect(section.startPoint).toEqual({ x: 200, y: 143 });
    expect(section.bendPoints).toEqual([
      { x: 250, y: 143 },
      { x: 250, y: 154 },
    ]);
    expect(section.endPoint).toEqual({ x: 300, y: 154 });
  });

  it("keeps every segment axis-aligned after inserting a jog", () => {
    const layout = layoutWith([{ startPoint: { x: 200, y: 154 }, endPoint: { x: 300, y: 154 } }]);

    alignEdgesToRows(layout, offsets);
    const [section] = layout.edges![0].sections!;
    const points = [section.startPoint, ...section.bendPoints!, section.endPoint];

    for (let i = 1; i < points.length; i += 1) {
      const isAxisAligned = points[i].x === points[i - 1].x || points[i].y === points[i - 1].y;
      expect(isAxisAligned).toBe(true);
    }
  });

  it("steers a jog away from a channel another edge already runs down", () => {
    // The jog crosses y 143..154 inside the gap x 200..300, and the first edge already runs
    // a vertical down x=220 across that same band.
    const layout: LayoutRoot = {
      children: [{ id: "src", y: 100 }],
      edges: [
        {
          properties: { from: "src", fromPort: "taken" },
          sections: [
            {
              startPoint: { x: 200, y: 120 },
              bendPoints: [
                { x: 220, y: 120 },
                { x: 220, y: 200 },
              ],
              endPoint: { x: 300, y: 200 },
            },
          ],
        },
        {
          properties: { from: "src", fromPort: "p" },
          sections: [{ startPoint: { x: 200, y: 154 }, endPoint: { x: 300, y: 154 } }],
        },
      ],
    };

    alignEdgesToRows(layout, new Map([["p", 43]]));
    const jog = layout.edges![1].sections![0].bendPoints!;

    // 250 is the plain midpoint and 220 is taken; of the candidates that tie on crossings,
    // 260 sits furthest from the taken channel.
    expect(jog[0].x).toBe(260);
    expect(jog[1].x).toBe(260);
  });

  it("routes a jog past a stub rather than cutting through it", () => {
    // The edge above leaves its node at y=480, runs to x=380 and turns up. The jog has to
    // cross y=480 to reach its row, and the plain midpoint of 300..400 would put it at 350
    // — inside that stub, and near enough the turn that the run back in cuts the vertical
    // too. Only past x=380 is clear of both.
    const layout: LayoutRoot = {
      children: [{ id: "src", y: 100 }],
      edges: [
        {
          properties: { from: "src", fromPort: "above" },
          sections: [
            {
              startPoint: { x: 300, y: 480 },
              bendPoints: [
                { x: 380, y: 480 },
                { x: 380, y: 200 },
              ],
              endPoint: { x: 400, y: 200 },
            },
          ],
        },
        {
          properties: { from: "src", fromPort: "p" },
          sections: [{ startPoint: { x: 300, y: 440 }, endPoint: { x: 400, y: 440 } }],
        },
      ],
    };

    alignEdgesToRows(layout, new Map([["p", 430]]));
    const jog = layout.edges![1].sections![0].bendPoints!;

    expect(jog[0]).toEqual({ x: 390, y: 530 });
    expect(jog[1]).toEqual({ x: 390, y: 440 });
  });

  it("still takes the midpoint when the channel it would cross is elsewhere vertically", () => {
    const layout: LayoutRoot = {
      children: [{ id: "src", y: 100 }],
      edges: [
        {
          properties: { from: "src", fromPort: "taken" },
          sections: [
            {
              startPoint: { x: 200, y: 900 },
              bendPoints: [
                { x: 250, y: 900 },
                { x: 250, y: 990 },
              ],
              endPoint: { x: 300, y: 990 },
            },
          ],
        },
        {
          properties: { from: "src", fromPort: "p" },
          sections: [{ startPoint: { x: 200, y: 154 }, endPoint: { x: 300, y: 154 } }],
        },
      ],
    };

    alignEdgesToRows(layout, new Map([["p", 43]]));

    expect(layout.edges![1].sections![0].bendPoints![0].x).toBe(250);
  });

  it("keeps two jogs in the same gap apart from each other", () => {
    const layout: LayoutRoot = {
      children: [{ id: "src", y: 100 }],
      edges: [
        {
          properties: { from: "src", fromPort: "a" },
          sections: [{ startPoint: { x: 200, y: 154 }, endPoint: { x: 300, y: 154 } }],
        },
        {
          properties: { from: "src", fromPort: "b" },
          sections: [{ startPoint: { x: 200, y: 158 }, endPoint: { x: 300, y: 158 } }],
        },
      ],
    };

    alignEdgesToRows(
      layout,
      new Map([
        ["a", 43],
        ["b", 45],
      ])
    );

    const [first, second] = layout.edges!.map(edge => edge.sections![0].bendPoints![0].x);
    expect(first).not.toBe(second);
  });

  it("is a no-op the second time, so a re-laid-out graph does not drift", () => {
    const layout = layoutWith([
      {
        startPoint: { x: 200, y: 154 },
        bendPoints: [
          { x: 230, y: 154 },
          { x: 230, y: 430 },
        ],
        endPoint: { x: 300, y: 430 },
      },
    ]);

    alignEdgesToRows(layout, offsets);
    const after = structuredClone(layout.edges![0].sections);
    alignEdgesToRows(layout, offsets);

    expect(layout.edges![0].sections).toEqual(after);
  });

  it("leaves edges with no port untouched — array items hang off the node itself", () => {
    const layout: LayoutRoot = {
      children: [{ id: "src", y: 100 }],
      edges: [
        {
          properties: { from: "src" },
          sections: [{ startPoint: { x: 200, y: 154 }, endPoint: { x: 300, y: 154 } }],
        },
      ],
    };

    alignEdgesToRows(layout, offsets);

    expect(layout.edges![0].sections![0].startPoint).toEqual({ x: 200, y: 154 });
    expect(layout.edges![0].sections![0].bendPoints).toBeUndefined();
  });

  it("leaves the edge alone when the source node is missing from the layout", () => {
    const layout: LayoutRoot = {
      children: [{ id: "other", y: 100 }],
      edges: [
        {
          properties: { from: "src", fromPort: "p" },
          sections: [{ startPoint: { x: 200, y: 154 }, endPoint: { x: 300, y: 154 } }],
        },
      ],
    };

    alignEdgesToRows(layout, offsets);

    expect(layout.edges![0].sections![0].startPoint.y).toBe(154);
  });
});
