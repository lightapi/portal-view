import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReplayWaiverPanel } from './ReplayWaiverPanel';

describe('ReplayWaiverPanel', () => {
  it('fails closed for ordered failures that would leave a projection gap', () => {
    const onRequest = vi.fn();
    render(<ReplayWaiverPanel failureIds={['failure-1']} currentUserId="operator-1" busy={false}
      orderedScopeSelected onRequest={onRequest} onApprove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Waiver reason'), { target: { value: 'acknowledge failure' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText(/cannot be waived.*permanent projection-version gap/s)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request waiver' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve waiver' })).toBeDisabled();
    expect(onRequest).not.toHaveBeenCalled();
  });
});
