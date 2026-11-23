/**
 * 이미지 파일을 브라우저로 열어 볼 수 있는지 확인한다. 화면에 그리지 않고 메모리에서만 해석한다.
 * 이름·형식이 JPG·PNG여도 내용이 손상됐으면 열리지 않아 `false`를 돌려준다.
 * 한계: 브라우저가 열어 주면 통과한다(일부만 손상된 JPG는 통과, PNG는 가운데가 손상돼도 걸러진다). 서버 검증이 필요하다.
 */
async function canDecodeImageFile(file: Blob): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * 고른 파일을 한 장씩 차례로 열어 보고 정상 파일과 손상 파일로 나눈다.
 * 한꺼번에 열면 메모리를 많이 쓰므로 순서대로 처리하고, 손상 파일을 만나도 멈추지 않고 끝까지 검사한다.
 */
export async function splitDecodableImages<TFile extends Blob>(
  files: TFile[]
): Promise<{ decodable: TFile[]; corrupt: TFile[] }> {
  const decodable: TFile[] = [];
  const corrupt: TFile[] = [];
  for (const file of files) {
    if (await canDecodeImageFile(file)) decodable.push(file);
    else corrupt.push(file);
  }
  return { decodable, corrupt };
}
