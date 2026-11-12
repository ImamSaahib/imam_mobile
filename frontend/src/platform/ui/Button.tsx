import React, { type ComponentProps } from 'react';
import { Button as KumoButton } from '@cloudflare/kumo/components/button';

type Props = ComponentProps<typeof KumoButton>;
/** Shared primitive; business actions are supplied by the caller. */
export function Button({ type = 'button', ...props }: Props) {
  return <KumoButton type={type} {...props} />;
}

type IconButtonProps = Omit<Props, 'children' | 'aria-label' | 'shape'> & {
  'aria-label': string;
};
export function IconButton(props: IconButtonProps) {
  return <Button shape="square" {...props} />;
}
