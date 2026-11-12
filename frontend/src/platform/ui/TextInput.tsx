import React, { type ComponentProps } from 'react';
import { Input as KumoInput } from '@cloudflare/kumo/components/input';

type Props = ComponentProps<typeof KumoInput>;
export function TextInput(props: Props) {
  return <KumoInput {...props} />;
}
