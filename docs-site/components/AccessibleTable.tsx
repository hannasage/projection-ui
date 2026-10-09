import type { TableHTMLAttributes } from 'react';

export function AccessibleTable(props: TableHTMLAttributes<HTMLTableElement>) {
  return <div role="group" aria-label="Scrollable reference table" tabIndex={0} className="relative overflow-auto prose-no-margin my-6">
    <table {...props} />
  </div>;
}
