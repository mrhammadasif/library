import { describe, expect, it } from 'vitest'
import { categoryPath, mergeDrafts, parseGoogleVolume, parseOpenLibraryData, suggestTags } from '../shared/metadata'

describe('tags and categories from subjects', () => {
  it('keeps the specific genre and the shelf section of a Google category path', () => {
    expect(categoryPath('Juvenile Fiction / Religious / Islamic')).toEqual(['Islamic', 'Juvenile Fiction'])
    expect(categoryPath('Fiction / Science Fiction / General')).toEqual(['Science Fiction', 'Fiction'])
    expect(categoryPath('History')).toEqual(['History'])
  })

  it('turns subject headings into short search tags', () => {
    expect(suggestTags(['Muhammad, Prophet, -632', 'Children\'s stories', 'Islam -- Juvenile literature', 'Prophets'])).toEqual(
      ['muhammad', 'children', 'stories', 'islamic', 'prophets'],
    )
    expect(suggestTags(['Juvenile Fiction / Religious / Islamic'])).toEqual(['children', 'islamic'])
  })

  it('drops noise and caps the list', () => {
    expect(suggestTags(['General', 'Fiction', 'Accessible book', 'Protected DAISY'])).toEqual([])
    expect(suggestTags(Array.from({ length: 20 }, (_, i) => `Topic${i}`))).toHaveLength(8)
  })

  it('fills tags while parsing and merging sources', () => {
    const ol = parseOpenLibraryData({ title: 'Stories of the Prophets', subjects: [{ name: 'Prophets' }, { name: 'Islam' }] })!
    const gb = parseGoogleVolume({ volumeInfo: { title: 'Stories of the Prophets', categories: ['Juvenile Nonfiction / Religious / Islam'] } })!
    expect(gb.categories).toEqual(['Islam', 'Juvenile Nonfiction'])
    expect(mergeDrafts(ol, gb)!.tags).toEqual(['children', 'islamic', 'prophets'])
  })
})

describe('open library noise', () => {
  it('ignores machine tags and long headings', () => {
    const subjects = ['Dune (Imaginary place)', 'Fiction', 'Fiction, science fiction, general', 'New York Times reviewed', 'Science fiction', 'science-fiction', 'award:hugo_award=1966', 'American literature']
    expect(suggestTags(subjects)).toEqual(['dune', 'imaginary place', 'science fiction'])
    expect(parseOpenLibraryData({ title: 'Dune', subjects: subjects.map(name => ({ name })) })!.categories).toEqual(['Science fiction'])
  })
})
