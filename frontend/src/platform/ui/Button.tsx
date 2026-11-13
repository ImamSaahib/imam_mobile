import React, { useState, type ComponentProps } from 'react';
import { Button as KumoButton } from '@cloudflare/kumo/components/button';

import { Tooltip, TooltipProvider } from '@cloudflare/kumo/components/tooltip';

type Props = ComponentProps<typeof KumoButton>;
/** Shared primitive; business actions are supplied by the caller. */
export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button({ type = 'button', ...props }, ref) {
  return <KumoButton ref={ref} type={type} {...props} />;
});

type IconButtonProps = Omit<Props, 'children' | 'aria-label' | 'shape'> & {
  'aria-label': string;
};
export function IconButton(props: IconButtonProps) {
  const [container, setContainer] = useState<HTMLSpanElement | null>(null);
  return <span ref={setContainer} className="im-icon-button"><TooltipProvider>
    <Tooltip content={props['aria-label']} container={container} render={<Button shape="square" {...props} />} />
  </TooltipProvider></span>;
}
