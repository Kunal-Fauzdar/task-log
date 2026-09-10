import { describe, expect, it } from "vitest";

import { NO_PROJECT_LABEL, groupTasksByProject, stripProjectSuffix } from "@/lib/domain/project";

const projects = [
  { id: "p-web", name: "Website" },
  { id: "p-app", name: "App" },
];

function task(id: string, projectId: string | null) {
  return { id, projectId };
}

describe("groupTasksByProject", () => {
  it("groups tasks by project, named groups first (by name), 'No project' last", () => {
    const groups = groupTasksByProject(
      [
        task("t1", "p-web"),
        task("t2", null),
        task("t3", "p-app"),
        task("t4", "p-web"),
      ],
      projects,
    );

    expect(groups.map((g) => g.name)).toEqual(["App", "Website", NO_PROJECT_LABEL]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["t1", "t4"]);
    expect(groups[2].projectId).toBeNull();
  });

  it("omits project groups that have no tasks", () => {
    const groups = groupTasksByProject([task("t1", "p-web")], projects);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Website");
  });

  it("omits the 'No project' group when every task has a project", () => {
    const groups = groupTasksByProject([task("t1", "p-web")], projects);
    expect(groups.some((g) => g.projectId === null)).toBe(false);
  });

  it("treats a task whose project no longer exists as 'No project'", () => {
    const groups = groupTasksByProject([task("t1", "p-deleted"), task("t2", null)], projects);
    expect(groups).toHaveLength(1);
    expect(groups[0].projectId).toBeNull();
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("returns nothing for an empty task list", () => {
    expect(groupTasksByProject([], projects)).toEqual([]);
  });
});

describe("stripProjectSuffix", () => {
  const names = ["Website Redesign", "Mobile App"];

  it("strips a trailing parenthetical that matches a known project name", () => {
    expect(stripProjectSuffix("Wired up checkout (Website Redesign)", names)).toBe(
      "Wired up checkout",
    );
  });

  it("matches project names case-insensitively and tolerates surrounding space", () => {
    expect(stripProjectSuffix("Fix nav  (website redesign)  ", names)).toBe("Fix nav");
  });

  it("leaves a trailing parenthetical that is NOT a known project alone", () => {
    expect(stripProjectSuffix("Fixed login (regression from PR 42)", names)).toBe(
      "Fixed login (regression from PR 42)",
    );
  });

  it("only touches a trailing parenthetical, not one mid-description", () => {
    expect(stripProjectSuffix("Refactor (big) chunk of the parser", names)).toBe(
      "Refactor (big) chunk of the parser",
    );
  });

  it("handles a multi-line description ending in the project tag", () => {
    expect(stripProjectSuffix("line one\nline two (Mobile App)", names)).toBe(
      "line one\nline two",
    );
  });

  it("is a no-op when there are no known project names", () => {
    expect(stripProjectSuffix("Anything (Website Redesign)", [])).toBe(
      "Anything (Website Redesign)",
    );
  });
});
