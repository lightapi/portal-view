import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyablePropertyValue } from './ConfigSnapshotProperty';

describe('CopyablePropertyValue', () => {
    it('copies the exact untruncated property value from the tooltip', async () => {
        const value = '{\n  "server": {\n    "port": 8080\n  }\n}';
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, 'writeText');

        const { container } = render(<CopyablePropertyValue value={value} />);

        await user.hover(container.querySelector('span')!);
        await user.click(await screen.findByRole('button', { name: 'Copy property value' }));

        expect(writeText).toHaveBeenCalledWith(value);
    });
});
