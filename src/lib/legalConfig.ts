/**
 * Single source of truth for the facts shown on the Terms and Privacy
 * pages. Change a value here and both pages update.
 */
export const LEGAL = {
  /** Name the service is operated under (matches the site footer). */
  operatorName: 'BIM Alumni Association',
  /** Short name used in running text. */
  operatorShort: 'BIMAA',
  institution: 'BIM, Trichy',
  serviceName: 'SuperConnector',
  contactEmail: 'bimaasuperconnector@gmail.com',
  siteUrl: 'https://bimaasuperconnector.github.io',
  /** Shown as "Effective date" and "Last updated" on both pages. */
  effectiveDate: '1 October 2026',
  /** Governing law named in the Terms. */
  governingLaw: 'the laws of India',
} as const;
