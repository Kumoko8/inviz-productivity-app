import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import GalleryTile from '../GalleryTile';

describe('GalleryTile', () => {
    it('renders video when url provided and shows name', () => {
        render(<GalleryTile name="Test" url="https://cdn/test.mp4" />);

        expect(screen.getByText('Test')).toBeInTheDocument();
        const video = document.querySelector('video');
        expect(video).toBeTruthy();
        expect((video && video.getAttribute('src')) || '').toContain('test.mp4');
    });

    it('renders placeholder when no url', () => {
        render(<GalleryTile name="Empty" />);

        expect(screen.getByText('Empty')).toBeInTheDocument();
        expect(screen.getByText('No preview')).toBeInTheDocument();
    });
});
