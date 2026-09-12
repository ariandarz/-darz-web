import { describe, expect, it } from 'vitest';
import { DESKTOP_BREAKPOINT, LayoutController } from './LayoutController';

describe('LayoutController.wantDesktop (app.html:2936-2945)', () => {
  it('picks desktop at the breakpoint and above, mobile below', () => {
    expect(LayoutController.wantDesktop(DESKTOP_BREAKPOINT, null)).toBe(true);
    expect(LayoutController.wantDesktop(DESKTOP_BREAKPOINT - 1, null)).toBe(false);
    expect(LayoutController.wantDesktop(1440, null)).toBe(true);
  });
  it('a per-device "mobile" override always wins; "desktop" still needs the width', () => {
    expect(LayoutController.wantDesktop(1440, 'mobile')).toBe(false);
    expect(LayoutController.wantDesktop(390, 'desktop')).toBe(false);
    expect(LayoutController.wantDesktop(1200, 'desktop')).toBe(true);
  });
});
