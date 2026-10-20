"use client";

import { useEffect, useRef } from "react";

type ComposerProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function Composer({
  value,
  disabled,
  onChange,
  onSubmit,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="forge-prompt">
        Message
      </label>
      <textarea
        id="forge-prompt"
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder="Ask about the code…"
        className="composer-input"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!disabled) onSubmit();
          }
        }}
      />
      <button
        type="submit"
        className="composer-send"
        disabled={disabled || !value.trim()}
      >
        Send
      </button>
    </form>
  );
}
