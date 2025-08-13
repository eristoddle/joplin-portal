// Obsidian DOM extensions
declare global {
  interface HTMLElement {
    empty(): void;
    createDiv(cls?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string> }): HTMLDivElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tagName: K,
      options?: { cls?: string | string[]; text?: string; attr?: Record<string, string>; type?: string; value?: string; href?: string; placeholder?: string; }
    ): HTMLElementTagNameMap[K];
    createSpan(cls?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string> }): HTMLSpanElement;
    setText(text: string): void;
    addClass(cls: string): void;
    removeClass(cls: string): void;
    toggleClass(cls: string, force?: boolean): void;
    hasClass(cls: string): boolean;
  }

  interface HTMLButtonElement {
    setText(text: string): void;
    addClass(cls: string): void;
    removeClass(cls: string): void;
    toggleClass(cls: string, force?: boolean): void;
    hasClass(cls: string): boolean;
  }

  interface HTMLSelectElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tagName: K,
      options?: { cls?: string | string[]; text?: string; attr?: Record<string, string>; type?: string; value?: string; placeholder?: string; }
    ): HTMLElementTagNameMap[K];
  }

  interface Element {
    empty(): void;
    createDiv(cls?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string> }): HTMLDivElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tagName: K,
      options?: { cls?: string | string[]; text?: string; attr?: Record<string, string>; type?: string; value?: string; href?: string; placeholder?: string; }
    ): HTMLElementTagNameMap[K];
    createSpan(cls?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string> }): HTMLSpanElement;
    addClass(cls: string): void;
    removeClass(cls: string): void;
    toggleClass(cls: string, force?: boolean): void;
    hasClass(cls: string): boolean;
  }
}

// Obsidian Modal extensions
declare module 'obsidian' {
  interface Modal {
    titleEl: HTMLElement;
    modalEl: HTMLElement;
    contentEl: HTMLElement;
  }

  interface ItemView {
    constructor(leaf: WorkspaceLeaf): void;
  }
}

export {};