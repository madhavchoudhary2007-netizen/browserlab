type Handler = (m: { payload: unknown }) => void;
/** Tests push engine events through window.__emit(payload). */
export async function listen(_name: string, handler: Handler) {
  (window as unknown as { __emit: (p: unknown) => void }).__emit = (payload) => handler({ payload });
  return () => undefined;
}
