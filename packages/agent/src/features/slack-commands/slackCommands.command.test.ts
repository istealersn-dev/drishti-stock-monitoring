import { describe, expect, it } from "vitest";

import { routeCommand } from "./slackCommands.command.js";

describe("routeCommand", () => {
  it("matches !status", () => {
    expect(routeCommand("!status")).toEqual({ command: "status" });
  });

  it("matches !status with trailing space", () => {
    expect(routeCommand("!status  ")).toEqual({ command: "status" });
  });

  it("matches !pnl", () => {
    expect(routeCommand("!pnl")).toEqual({ command: "pnl" });
  });

  it("matches !holdings", () => {
    expect(routeCommand("!holdings")).toEqual({ command: "holdings" });
  });

  it("matches !gtts", () => {
    expect(routeCommand("!gtts")).toEqual({ command: "gtts" });
  });

  it("matches !analyse with a stock name", () => {
    expect(routeCommand("!analyse Reliance")).toEqual({
      command: "analyse",
      query: "Reliance",
    });
  });

  it("matches !analyse with multi-word stock name", () => {
    expect(routeCommand("!analyse Ramco Systems")).toEqual({
      command: "analyse",
      query: "Ramco Systems",
    });
  });

  it("is case-insensitive", () => {
    expect(routeCommand("!STATUS")).toEqual({ command: "status" });
    expect(routeCommand("!ANALYSE HDFC")).toEqual({ command: "analyse", query: "HDFC" });
  });

  it("returns null for unrecognised text", () => {
    expect(routeCommand("hello")).toBeNull();
    expect(routeCommand("buy something")).toBeNull();
    expect(routeCommand("!unknown")).toBeNull();
  });

  it("returns null for !analyse without a query", () => {
    expect(routeCommand("!analyse")).toBeNull();
    expect(routeCommand("!analyse  ")).toBeNull();
  });
});
