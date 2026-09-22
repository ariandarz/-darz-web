/**
 * Component-test setup — `vitest.config.ts`'s `components` project only.
 *
 * Two things, both of which a component test is unreadable without:
 *
 *  - **`jest-dom/vitest`** registers the DOM matchers (`toBeDisabled`,
 *    `toHaveAttribute`, `toHaveTextContent`). Without them those assertions
 *    do not fail — they throw `Invalid Chai property`, which reads like a
 *    broken test rather than a missing import.
 *  - **`cleanup`** unmounts between cases. Without it a component mounted by
 *    one test is still in the document for the next, and a query that should
 *    find one element finds two.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
