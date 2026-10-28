// A small stand-in for the page's document, for tests of the HTML strips drawn over the canvas
// (the feedback question): elements keep their children, classes, attributes and handlers.

export class FakeEl {
  id = '';
  className = '';
  textContent: string | null = '';
  value = '';
  placeholder = '';
  maxLength = -1;
  onclick: (() => void) | null = null;
  parent: FakeEl | null = null;
  children: (FakeEl | string)[] = [];
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, ((e: { stopPropagation(): void }) => void)[]>();
  readonly classList = {
    contains: (c: string) => this.className.split(' ').includes(c),
    toggle: (c: string, on: boolean) => {
      const set = new Set(this.className.split(' ').filter(Boolean));
      if (on) set.add(c);
      else set.delete(c);
      this.className = [...set].join(' ');
    },
  };

  constructor(readonly tagName: string) {}

  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(name: string, fn: (e: { stopPropagation(): void }) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  appendChild(c: FakeEl): FakeEl {
    this.append(c);
    return c;
  }
  append(...cs: (FakeEl | string)[]): void {
    for (const c of cs) {
      if (typeof c !== 'string') {
        c.remove();
        c.parent = this;
      }
      this.children.push(c);
    }
  }
  replaceChild(next: FakeEl, old: FakeEl): void {
    next.remove();
    const i = this.children.indexOf(old);
    this.children[i] = next;
    next.parent = this;
    old.parent = null;
  }
  replaceChildren(...cs: (FakeEl | string)[]): void {
    for (const c of this.children) if (typeof c !== 'string') c.parent = null;
    this.children = [];
    this.append(...cs);
  }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }

  /** Every element under this one, depth first. */
  all(): FakeEl[] {
    return this.children.flatMap((c) => (typeof c === 'string' ? [] : [c, ...c.all()]));
  }
  /** The first element under this one carrying class `c`. */
  find(c: string): FakeEl | undefined {
    return this.all().find((e) => e.classList.contains(c));
  }
  /** All text under this one, in order. */
  text(): string {
    return this.children.map((c) => (typeof c === 'string' ? c : c.textContent || c.text())).join('');
  }
}

export class FakeDoc {
  readonly head = new FakeEl('head');
  readonly body = new FakeEl('body');

  createElement(tag: string): FakeEl {
    return new FakeEl(tag);
  }
  getElementById(id: string): FakeEl | null {
    return [...this.head.all(), ...this.body.all()].find((e) => e.id === id) ?? null;
  }
  asDocument(): Document {
    return this as unknown as Document;
  }
}
