import { expect, test } from '@playwright/test'
import { mockSyncIdentity } from './helpers/sync-identity-mock'
import type { ReaderPublication } from '../src/lib/reader/types'

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII='
const text = 'A little bold thought. Read note 1.'
const diagram = '  A ---> B\n  |      |\n  C <--- D'
const publication: ReaderPublication = {
  id: 'rich-fixture', title: 'Formatted EPUB fixture', sourceType: 'epub',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  chapters: [
    {
      id: 'chapter-one', title: 'First chapter', order: 0, wordCount: 20,
      paragraphs: ['A preserved heading', text, '', diagram],
      blocks: [
        { id: 'heading', kind: 'heading', text: 'A preserved heading', level: 3 },
        { id: 'text', kind: 'paragraph', text, runs: [
          { text: 'A ' }, { text: 'little ', italic: true }, { text: 'bold', bold: true },
          { text: ' thought. Read note ' },
          { text: '1', superscript: true, href: '/games/e-reader/read/rich-fixture/chapter-two#footnote-one' },
          { text: '.' },
        ] },
        { id: 'image', kind: 'image', text: '', image: { src: pixel, alt: 'Original diagram' } },
        { id: 'ascii', kind: 'preformatted', text: diagram },
      ],
    },
    {
      id: 'chapter-two', title: 'Notes', order: 1, wordCount: 5,
      paragraphs: ['The complete original footnote.'],
      blocks: [{ id: 'note', kind: 'paragraph', text: 'The complete original footnote.', anchorId: 'footnote-one' }],
    },
  ],
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`rich EPUB preserves formatting, images, search and footnotes at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await mockSyncIdentity(page)
    await page.route('**/api/reader/comments?**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }))
    await page.route('**/api/reader/communal/**', (route) => {
      const state = route.request().url().includes('/reading-state')
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state ? null : publication) })
    })
    await page.goto('/games/e-reader/read/rich-fixture/chapter-one')
    const article = page.getByRole('article', { name: 'First chapter reading text' })
    await expect(article.getByRole('heading', { name: 'A preserved heading' })).toBeVisible()
    await expect(article.locator('em')).toHaveText('little ')
    await expect(article.locator('strong')).toHaveText('bold')
    await expect(article.locator('sup')).toHaveText('1')
    await expect(article.locator('[data-reader-kind="preformatted"]')).toHaveText(diagram)
    await expect(article.locator('[data-reader-kind="preformatted"]')).toHaveCSS('white-space', 'pre')
    await expect(page.getByRole('navigation', { name: 'Table of contents', exact: true })).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Customize your reading view' })).toBeHidden()

    await article.getByRole('button', { name: 'Enlarge illustration: Original diagram' }).click()
    await expect(page.getByRole('dialog', { name: 'Original diagram' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Original diagram' })).toBeHidden()

    if (viewport.width < 768) await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByPlaceholder('Search in book…').fill('little bold')
    await page.getByRole('button', { name: 'Find', exact: true }).click()
    await expect(article.locator('em mark')).toHaveText('little ')
    await expect(article.locator('strong mark')).toHaveText('bold')
    await expect(article.locator('[data-search-paragraph="1"]')).toHaveText(text)
    await page.getByRole('button', { name: 'Clear', exact: true }).click()

    // Existing highlight gestures must retain the original inline emphasis.
    await article.locator('em').dblclick()
    await expect(article.locator('.reader-user-hl em')).toContainText('little')
    expect(await article.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)

    await article.getByRole('link', { name: '1', exact: true }).click()
    await expect(page).toHaveURL(/chapter-two#footnote-one$/)
    await expect(page.locator('#footnote-one')).toHaveText('The complete original footnote.')
    await page.getByRole('button', { name: 'Previous chapter', exact: true }).last().click()
    await expect(page.getByRole('article', { name: 'First chapter reading text' })).toBeVisible()
    await page.getByRole('button', { name: 'Next chapter', exact: true }).last().click()
    await expect(page.getByRole('article', { name: 'Notes reading text' })).toBeVisible()
  })
}
