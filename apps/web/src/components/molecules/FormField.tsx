import { cloneElement, useId, type ReactElement } from 'react';

/** Label + control + hint/error wired together with ids (aria-describedby). */
export function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; invalid?: boolean }>;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {cloneElement(children, {
        id,
        invalid: Boolean(error),
        'aria-describedby': note ? noteId : undefined,
      })}
      {note && (
        <p
          id={noteId}
          role={error ? 'alert' : undefined}
          className={error ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}
        >
          {note}
        </p>
      )}
    </div>
  );
}
