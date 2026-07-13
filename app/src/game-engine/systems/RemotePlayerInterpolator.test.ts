import { describe, expect, it } from "vitest";
import { RemotePlayerInterpolator } from "./RemotePlayerInterpolator";

describe("remote player interpolation", () => {
  it("interpolates between timestamped snapshots", () => {
    const interpolator = new RemotePlayerInterpolator(100);
    interpolator.push("remote", { x: 0, y: 20, timestamp: 1000, sequence: 1 });
    interpolator.push("remote", { x: 100, y: 40, timestamp: 1100, sequence: 2 });

    expect(interpolator.sample("remote", 1150)).toEqual({ x: 50, y: 30 });
  });

  it("ignores stale sequence numbers and caps its buffer", () => {
    const interpolator = new RemotePlayerInterpolator(0, 3);
    interpolator.push("remote", { x: 3, y: 0, timestamp: 3, sequence: 3 });
    interpolator.push("remote", { x: 2, y: 0, timestamp: 2, sequence: 2 });
    interpolator.push("remote", { x: 4, y: 0, timestamp: 4, sequence: 4 });
    interpolator.push("remote", { x: 5, y: 0, timestamp: 5, sequence: 5 });
    interpolator.push("remote", { x: 6, y: 0, timestamp: 6, sequence: 6 });

    expect(interpolator.sample("remote", 6)).toEqual({ x: 6, y: 0 });
    expect(interpolator.bufferSize("remote")).toBe(3);
  });
});
