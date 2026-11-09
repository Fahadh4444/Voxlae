"use client";

/**
 * Template registry — maps a ProfileTemplateId to the component that renders it.
 * The public profile container looks a template up here; the picker page reads the
 * metadata list from ./types. Add a new template in three places: a component file,
 * this map, and the TEMPLATES array in ./types.
 */

import React from 'react';
import { ProfileTemplateId } from '../../../api/types';
import { ProfileTemplateProps } from './types';
import ClassicTemplate from './ClassicTemplate';
import GalleryTemplate from './GalleryTemplate';
import EditorialTemplate from './EditorialTemplate';
import SpotlightTemplate from './SpotlightTemplate';
import StudioTemplate from './StudioTemplate';
import IndexTemplate from './IndexTemplate';
import TerminalTemplate from './TerminalTemplate';
import BrutalistTemplate from './BrutalistTemplate';
import BentoTemplate from './BentoTemplate';

export const TEMPLATE_COMPONENTS: Record<ProfileTemplateId, React.FC<ProfileTemplateProps>> = {
  CLASSIC: ClassicTemplate,
  GALLERY: GalleryTemplate,
  EDITORIAL: EditorialTemplate,
  SPOTLIGHT: SpotlightTemplate,
  STUDIO: StudioTemplate,
  INDEX: IndexTemplate,
  TERMINAL: TerminalTemplate,
  BRUTALIST: BrutalistTemplate,
  BENTO: BentoTemplate,
};

export { TEMPLATES } from './types';
export type { ProfileTemplateProps, TemplateMeta } from './types';
