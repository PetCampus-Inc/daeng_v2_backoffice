import { describe, expect, it } from 'vitest';
import {
  NOTICE_IMAGE_BATCH_MESSAGE,
  NOTICE_IMAGE_COUNT_MESSAGE,
  NOTICE_IMAGE_EMPTY_MESSAGE,
  NOTICE_IMAGE_SIZE_MESSAGE,
  NOTICE_IMAGE_TYPE_MESSAGE,
  checkNoticeImageFiles,
  createNoticeBody,
  getNoticeText,
  validateNotice,
} from './index';

describe('공지 입력 검증', () => {
  it('빈 초안을 저장할 수 있지만 공백뿐인 공지를 게시할 수 없다', () => {
    expect(validateNotice({ title: '', body: createNoticeBody('') })).toMatchObject({
      canSave: true,
      canPublish: false,
    });
    expect(validateNotice({ title: '  ', body: createNoticeBody('내용') }).canPublish).toBe(false);
    expect(validateNotice({ title: '공지', body: createNoticeBody('\n ') }).canPublish).toBe(false);
  });
  it('제목 50자·본문 5,000자 경계를 검사한다', () => {
    expect(validateNotice({ title: '가'.repeat(50), body: createNoticeBody('가'.repeat(5000)) })).toMatchObject({
      canSave: true,
      canPublish: true,
      titleCount: 50,
      bodyCount: 5000,
    });
    expect(validateNotice({ title: '가'.repeat(51), body: createNoticeBody('내용') }).canSave).toBe(false);
    expect(validateNotice({ title: '공지', body: createNoticeBody('가'.repeat(5001)) }).canPublish).toBe(false);
  });
  it('본문 글자 수는 서버 기준이다: 이모지 1자, 블록 사이 줄바꿈 제외', () => {
    expect(validateNotice({ title: '공지', body: createNoticeBody('😀'.repeat(5000)) })).toMatchObject({
      bodyCount: 5000,
      canSave: true,
    });
    expect(validateNotice({ title: '공지', body: createNoticeBody('가\n나\n다') }).bodyCount).toBe(3);
  });
  it('제목 글자 수는 서버와 같은 내부 길이(UTF-16)로 센다. 이모지는 2자다', () => {
    expect(validateNotice({ title: '😀'.repeat(25), body: createNoticeBody('내용') })).toMatchObject({
      titleCount: 50,
      canSave: true,
    });
    expect(validateNotice({ title: '😀'.repeat(26), body: createNoticeBody('내용') })).toMatchObject({
      titleCount: 52,
      canSave: false,
      canPublish: false,
    });
  });
  it('줄바꿈·빈 문단·HTML 글자를 그대로 보존한다', () => {
    const text = '\n<b>굵게</b>\n\n마지막 줄\n';
    expect(getNoticeText(createNoticeBody(text))).toBe(text);
  });
});

describe('공지 이미지 파일 검사 (R-공지이미지)', () => {
  const MB = 1024 * 1024;
  const image = (name: string, type: string, size = MB) => ({ name, type, size });
  const png = (size = MB) => image('a.png', 'image/png', size);

  it('JPG·JPEG·PNG 1MB는 올릴 수 있다', () => {
    expect(checkNoticeImageFiles([image('a.jpg', 'image/jpeg')], 0)).toBeNull();
    expect(checkNoticeImageFiles([image('a.JPEG', 'image/jpeg')], 0)).toBeNull();
    expect(checkNoticeImageFiles([png()], 0)).toBeNull();
  });
  it('HEIC·HEIF·GIF·PDF는 올릴 수 없다', () => {
    for (const file of [
      image('a.heic', 'image/heic'),
      image('a.heif', 'image/heif'),
      image('a.gif', 'image/gif'),
      image('a.pdf', 'application/pdf'),
    ]) {
      expect(checkNoticeImageFiles([file], 0)).toBe(NOTICE_IMAGE_TYPE_MESSAGE);
    }
  });
  it('이름의 확장자가 형식과 다르면 올릴 수 없다(서버가 거절한다)', () => {
    expect(checkNoticeImageFiles([image('a.png', 'image/jpeg')], 0)).toBe(NOTICE_IMAGE_TYPE_MESSAGE);
    expect(checkNoticeImageFiles([image('a', 'image/png')], 0)).toBe(NOTICE_IMAGE_TYPE_MESSAGE);
  });
  it('파일 크기는 20,971,520바이트까지 올릴 수 있고 1바이트 넘으면 막는다', () => {
    expect(checkNoticeImageFiles([png(20_971_520)], 0)).toBeNull();
    expect(checkNoticeImageFiles([png(20_971_521)], 0)).toBe(NOTICE_IMAGE_SIZE_MESSAGE);
    expect(checkNoticeImageFiles([png(1)], 0)).toBeNull();
    expect(checkNoticeImageFiles([png(0)], 0)).toBe(NOTICE_IMAGE_EMPTY_MESSAGE);
  });
  it('여러 장 중 하나라도 걸리면 전부 막는다', () => {
    expect(checkNoticeImageFiles([png(), png(20_971_521)], 0)).toBe(NOTICE_IMAGE_SIZE_MESSAGE);
    expect(checkNoticeImageFiles([png(), image('a.gif', 'image/gif')], 0)).toBe(NOTICE_IMAGE_TYPE_MESSAGE);
  });
  it('한 번에 10장까지 올릴 수 있고 11장은 막는다', () => {
    expect(
      checkNoticeImageFiles(
        Array.from({ length: 10 }, () => png()),
        0
      )
    ).toBeNull();
    expect(
      checkNoticeImageFiles(
        Array.from({ length: 11 }, () => png()),
        0
      )
    ).toBe(NOTICE_IMAGE_BATCH_MESSAGE);
  });
  it('본문 이미지는 10장까지다: 9장에 1장 더는 되고 10장에 1장 더는 막는다', () => {
    expect(checkNoticeImageFiles([png()], 9)).toBeNull();
    expect(checkNoticeImageFiles([png()], 10)).toBe(NOTICE_IMAGE_COUNT_MESSAGE);
    expect(checkNoticeImageFiles([png(), png()], 9)).toBe(NOTICE_IMAGE_COUNT_MESSAGE);
  });
  it('여러 규칙에 걸리면 한 번에 10개, 본문 10장, 형식, 용량 순으로 안내한다', () => {
    const tooMany = Array.from({ length: 11 }, () => image('a.gif', 'image/gif', 20_971_521));
    expect(checkNoticeImageFiles(tooMany, 5)).toBe(NOTICE_IMAGE_BATCH_MESSAGE);
    expect(checkNoticeImageFiles([image('a.gif', 'image/gif', 20_971_521)], 10)).toBe(NOTICE_IMAGE_COUNT_MESSAGE);
    expect(checkNoticeImageFiles([image('a.gif', 'image/gif', 20_971_521)], 0)).toBe(NOTICE_IMAGE_TYPE_MESSAGE);
  });
});
