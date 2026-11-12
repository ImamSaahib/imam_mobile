import React, { type ComponentProps } from 'react';
import { Button as KumoButton } from '@cloudflare/kumo/components/button';

type Props = ComponentProps<typeof KumoButton>;
/** Shared primitive; business actions are supplied by the caller. */
export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button({ type = 'button', ...props }, ref) {
  return <KumoButton ref={ref} type={type} {...props} />;
});

type IconButtonProps = Omit<Props, 'children' | 'aria-label' | 'shape'> & {
  'aria-label': string;
};
export function IconButton(props: IconButtonProps) {
  return <Button shape="square" {...props} />;
}
