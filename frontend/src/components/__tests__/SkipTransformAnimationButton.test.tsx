import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SkipTransformAnimationButton from '../SkipTransformAnimationButton';

describe('SkipTransformAnimationButton', () => {
    it('explains the irreversible action on focus and invokes skip', async () => {
        const onSkip = vi.fn();
        render(<SkipTransformAnimationButton onSkip={onSkip} />);
        const button = screen.getByRole('button', { name: 'Skip animation' });

        fireEvent.keyDown(document, { key: 'Tab' });
        button.focus();
        expect(await screen.findByRole('tooltip')).toHaveTextContent('cannot be undone');
        fireEvent.click(button);
        expect(onSkip).toHaveBeenCalledOnce();
    });

    it('prevents skipping again while finalizing', () => {
        const onSkip = vi.fn();
        render(<SkipTransformAnimationButton onSkip={onSkip} disabled />);
        const button = screen.getByRole('button', { name: 'Skip animation' });

        expect(button).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(button);
        expect(onSkip).not.toHaveBeenCalled();
    });
});
