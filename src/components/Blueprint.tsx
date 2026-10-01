import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/** The four `+` registration marks a `.blueprint` frame wears. */
export function Corners() {
  return (
    <>
      <i className="corner tl" aria-hidden="true" />
      <i className="corner tr" aria-hidden="true" />
      <i className="corner bl" aria-hidden="true" />
      <i className="corner br" aria-hidden="true" />
    </>
  );
}

interface BlueprintProps extends ComponentPropsWithoutRef<'section'> {
  children: ReactNode;
}

/** A `.blueprint` section with its corner marks. */
export function Blueprint({ className = '', children, ...rest }: BlueprintProps) {
  return (
    <section className={`blueprint ${className}`} {...rest}>
      <Corners />
      {children}
    </section>
  );
}
