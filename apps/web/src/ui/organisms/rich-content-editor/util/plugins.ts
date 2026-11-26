import {
  BasicBlocksPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
} from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list-classic/react';
import { LinkPlugin } from '@platejs/link/react';
import { ImagePlugin } from '@platejs/media/react';
import { TablePlugin } from '@platejs/table/react';
import { createPlatePlugin } from 'platejs/react';
import { isHttpUrl } from '@/util/rich-content';

export const PLUGINS = [
  createPlatePlugin({ key: 'fontSize', node: { isLeaf: true } }),
  BasicBlocksPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  ListPlugin,
  LinkPlugin.configure({ options: { isUrl: isHttpUrl } }),
  TablePlugin,
  // 주소가 든 HTML 이미지(웹페이지에서 복사한 그림 등)는 서버가 받지 않는 모양(url)이라 막고, 플러그인 기본 업로드도 끈다.
  // 이미지 파일은 업로드 버튼·본문에 끌어다 놓기·이미지 파일 붙여넣기만 받고, 셋 다 `RichContentEditor`의 업로드 경로로 처리한다.
  ImagePlugin.configure({
    options: { disableEmbedInsert: true, disableUploadInsert: true },
    parsers: { html: { deserializer: { query: () => false } } },
  }),
];
