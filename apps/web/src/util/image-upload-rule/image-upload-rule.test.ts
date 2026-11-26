import { describe, expect, it } from 'vitest';
import { checkImageFiles, limitImageCount } from './index';

const MB = 1024 * 1024;
const rule = {
  allowedTypes: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
  typeLabel: 'JPG·PNG',
  maxBytes: 20 * MB,
  maxCount: 10,
};

describe('이미지 파일 검사 (R-공지이미지)', () => {
  const image = (name: string, type: string, size = MB) => ({
    name,
    type,
    size,
  });
  const png = (size = MB, name = 'a.png') => image(name, 'image/png', size);
  const typeLine = { label: 'JPG·PNG가 아닌 파일', count: 1 };
  const emptyLine = { label: '비어 있는 파일', count: 1 };
  const sizeLine = { label: '20MB를 넘는 파일', count: 1 };

  it('JPG·JPEG·PNG 1MB는 올릴 수 있다', () => {
    const files = [image('a.jpg', 'image/jpeg'), image('a.JPEG', 'image/jpeg'), png()];
    expect(checkImageFiles(files, rule)).toEqual({
      passed: files,
      rejections: [],
    });
  });
  it('HEIC·HEIF·GIF·PDF는 올리지 않고 형식으로 센다', () => {
    const files = [
      image('a.heic', 'image/heic'),
      image('a.heif', 'image/heif'),
      image('a.gif', 'image/gif'),
      image('a.pdf', 'application/pdf'),
    ];
    expect(checkImageFiles(files, rule)).toEqual({
      passed: [],
      rejections: [{ ...typeLine, count: 4 }],
    });
  });
  it('이름의 확장자가 형식과 다르면 형식으로 센다(서버가 거절한다)', () => {
    const files = [image('a.png', 'image/jpeg'), image('a', 'image/png')];
    expect(checkImageFiles(files, rule)).toEqual({
      passed: [],
      rejections: [{ ...typeLine, count: 2 }],
    });
  });
  it('정확히 최대 용량은 올리고 1바이트 넘으면 용량 초과로, 0바이트는 빈 파일로 센다', () => {
    const limit = png(20_971_520);
    const tiny = png(1);
    expect(checkImageFiles([limit, tiny], rule)).toEqual({
      passed: [limit, tiny],
      rejections: [],
    });
    expect(checkImageFiles([png(20_971_521)], rule)).toEqual({
      passed: [],
      rejections: [sizeLine],
    });
    expect(checkImageFiles([png(0)], rule)).toEqual({
      passed: [],
      rejections: [emptyLine],
    });
  });
  it('최대 용량 안내는 값에서 MB로 계산한다', () => {
    expect(checkImageFiles([png(5 * MB + 1)], { ...rule, maxBytes: 5 * MB }).rejections).toEqual([
      { label: '5MB를 넘는 파일', count: 1 },
    ]);
  });
  it('형식 안내 문구의 조사는 형식 이름의 받침에 맞춘다', () => {
    const files = [image('a.gif', 'image/gif')];
    expect(checkImageFiles(files, { ...rule, typeLabel: 'JPG·PNG' }).rejections[0].label).toBe('JPG·PNG가 아닌 파일');
    expect(checkImageFiles(files, { ...rule, typeLabel: 'JPG·DOCM' }).rejections[0].label).toBe('JPG·DOCM이 아닌 파일');
  });
  it('걸린 파일만 빼고 나머지는 고른 순서대로 올리고, 이유는 형식, 빈 파일, 용량 순으로 돌려준다', () => {
    const first = png(MB, 'first.png');
    const second = image('second.jpg', 'image/jpeg');
    const result = checkImageFiles([first, png(20_971_521), png(0), image('a.gif', 'image/gif'), second], rule);
    expect(result.passed).toEqual([first, second]);
    expect(result.rejections).toEqual([typeLine, emptyLine, sizeLine]);
  });
  it('한 파일에 이유가 여럿이면 형식, 빈 파일, 용량 순으로 먼저 걸리는 하나만 센다', () => {
    expect(
      checkImageFiles([image('a.gif', 'image/gif', 0), image('b.gif', 'image/gif', 20_971_521)], rule).rejections
    ).toEqual([{ ...typeLine, count: 2 }]);
    expect(checkImageFiles([png(0)], rule).rejections).toEqual([emptyLine]);
  });
});

describe('이미지 개수 한도 (R-공지이미지)', () => {
  const files = (count: number) => Array.from({ length: count }, (_, index) => `file-${index + 1}`);
  const over = (count: number) => [{ label: '10장 한도를 넘는 이미지', count }];

  it('10장을 고르면 모두 올리고 11장을 고르면 앞 10장만 올리고 1장을 개수 초과로 센다', () => {
    expect(limitImageCount(files(10), 0, rule)).toEqual({
      uploadable: files(10),
      rejections: [],
    });
    expect(limitImageCount(files(11), 0, rule)).toEqual({
      uploadable: files(10),
      rejections: over(1),
    });
  });
  it('본문에 8장이 있을 때 4장을 고르면 앞 2장만 올린다', () => {
    expect(limitImageCount(files(4), 8, rule)).toEqual({
      uploadable: ['file-1', 'file-2'],
      rejections: over(2),
    });
  });
  it('본문이 10장이면 하나도 올리지 않고, 9장이면 1장은 올린다', () => {
    expect(limitImageCount(files(1), 10, rule)).toEqual({
      uploadable: [],
      rejections: over(1),
    });
    expect(limitImageCount(files(2), 9, rule)).toEqual({
      uploadable: ['file-1'],
      rejections: over(1),
    });
  });
  it('본문에 최대보다 많이 들어 있어도 남은 자리는 0이다', () => {
    expect(limitImageCount(files(1), 12, rule)).toEqual({
      uploadable: [],
      rejections: over(1),
    });
  });
  it('고른 파일이 없으면 올릴 것도 개수 초과도 없다', () => {
    expect(limitImageCount([], 0, rule)).toEqual({
      uploadable: [],
      rejections: [],
    });
  });
});
