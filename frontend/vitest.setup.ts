import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without vitest `globals`, RTL's automatic per-test cleanup does not run, so
// mounted components leak into the next test's DOM. Unmount them explicitly.
afterEach(() => {
  cleanup();
});
