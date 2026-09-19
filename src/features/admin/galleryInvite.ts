/**
 * galleryInvite — the message that actually reaches the gallery.
 *
 * Issuing a portal link gave the admin two boxes and two Copy buttons: the
 * address and the six-digit code. Everything after that — what to call the
 * thing, what the gallery is supposed to do with it, the reminder that the
 * code is private — was left for the admin to write again for every partner.
 * The old panel did not leave that to memory: it kept the message as a
 * template and handed it to WhatsApp ready to send.
 *
 * Both templates here are that panel's, cited line by line:
 *
 *  · `invitationMessage` follows `_inviteMsg` (`darz-studio.html:36198`),
 *    the collector invitation — the only "here is your private access"
 *    message Darz has. Its shape is kept exactly: welcome · what this is ·
 *    the labelled credentials · "open this link to enter" · the privacy
 *    line. Its collector wording ("our collector network", "access key") is
 *    replaced by the portal's own, taken from the portal's welcome card
 *    (`gallery-update.html`, ported at `PortalPage.tsx`: "Welcome to your
 *    private space with Darz" · "access code"), so a gallery reads the same
 *    words in the message and on the screen it lands on.
 *
 *  · `reminderMessage` is `_galMsg` (`darz-studio.html:36197`) verbatim —
 *    the nudge Darz already sends a partner whose portal has gone quiet.
 *    Kept because it is real shipped copy; it needs the link, which is only
 *    in hand at issue time (a link is not retrievable afterwards —
 *    G-PORT-13), so it is offered there and nowhere else.
 *
 * Both return plain text with real newlines: it goes to the clipboard and
 * from there into WhatsApp, an email or a message — never into markup.
 */

export interface InviteParts {
  /** The partner's name, as the record spells it. */
  name: string;
  /** The contact's own name, when the record has one — the message greets a
   * person if it can, and the gallery if it cannot. */
  contactName?: string;
  /** The full portal address, origin included. */
  url: string;
  /** The six-digit access code. */
  pin: string;
}

const greeting = (p: InviteParts) => {
  const who = (p.contactName || '').trim() || (p.name || '').trim();
  return who ? `Hello ${who},` : 'Hello,';
};

/**
 * The invitation — what a partner is sent the first time. `_inviteMsg`'s
 * shape (:36198), the portal's own words.
 */
export function invitationMessage(p: InviteParts): string {
  return [
    greeting(p),
    '',
    'Welcome to your private space with Darz — somewhere to confirm which works are still available, refine anything that has changed, and share new works, calmly, whenever it suits you.',
    '',
    `Your portal: ${p.url}`,
    `Your access code: ${p.pin}`,
    '',
    'Open the link, enter the code, and you are in. Nothing you send is published — Darz reviews every update first.',
    '',
    'This link and code are yours alone. Please keep them private.',
    '',
    'Thank you,',
    'darzmarket.art',
  ].join('\n');
}

/**
 * The reminder — `_galMsg` (:36197), verbatim but for the greeting, which
 * that template builds the same way.
 */
export function reminderMessage(p: InviteParts): string {
  return [
    greeting(p),
    '',
    'When you have a moment, could you refresh your availability on your Darz update portal? It keeps everything current for our collectors.',
    '',
    p.url,
    '',
    'Thank you,',
    'darzmarket.art',
  ].join('\n');
}
