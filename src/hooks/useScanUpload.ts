import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Upload, message } from 'antd';
import type { UploadFile, UploadProps } from 'antd';

// antd 버전에 따라 실제 File 객체가 놓이는 위치가 달라서 방어적으로 훑는다.
const resolveFile = (item: UploadFile): File | undefined => {
  const candidate = (item.originFileObj
    ?? (item as unknown as { file?: File }).file
    ?? item) as File | undefined;
  return candidate && candidate.size > 0 ? candidate : undefined;
};

export interface ScanUpload {
  fileList: UploadFile[];
  setFileList: Dispatch<SetStateAction<UploadFile[]>>;
  uploadProps: UploadProps;
  /** 첫 번째 이미지의 미리보기 URL. 이미지가 아니면 undefined. */
  previewUrl?: string;
  /** 스캔에 넘길 유효한 File 목록 */
  getFiles: () => File[];
}

/**
 * 이미지/PDF 업로드 + 클립보드 붙여넣기 + 미리보기를 한데 묶는다.
 * SimplePurchase와 ContractPurchase가 각자 갖고 있던 구현을 통합한 것.
 */
export function useScanUpload(): ScanUpload {
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // Ctrl+V로 캡처 이미지 붙여넣기
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.indexOf('image') !== -1) {
          const file = clipboardItems[i].getAsFile();
          if (file && file.size > 0) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;

      const stamp = Date.now();
      const pasted: UploadFile[] = imageFiles.map((file, idx) => ({
        uid: `pasted-${stamp}-${idx}`,
        name: file.name === 'image.png' ? `pasted-image-${stamp}-${idx}.png` : file.name,
        status: 'done',
        originFileObj: file as UploadFile['originFileObj'],
      }));
      setFileList((prev) => [...prev, ...pasted]);
      message.success(`${imageFiles.length}장의 이미지가 붙여넣기 되었습니다.`);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const uploadProps: UploadProps = useMemo(() => ({
    multiple: true,
    showUploadList: false,
    accept: 'image/*,application/pdf',
    fileList,
    onChange: (info) => setFileList(info.fileList),
    beforeUpload: (file) => {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        message.error('엑셀 파일은 스캔할 수 없습니다. 이미지(.jpg, .png) 또는 PDF 파일만 업로드해주세요!');
        return Upload.LIST_IGNORE;
      }
      return false; // 자동 업로드 차단 (서버가 없다)
    },
  }), [fileList]);

  const getFiles = useCallback(
    () => fileList.map(resolveFile).filter((f): f is File => Boolean(f)),
    [fileList],
  );

  const previewFile = useMemo(() => {
    const first = fileList[0] ? resolveFile(fileList[0]) : undefined;
    return first && first.type.startsWith('image/') ? first : undefined;
  }, [fileList]);

  const previewUrl = useMemo(
    () => (previewFile ? URL.createObjectURL(previewFile) : undefined),
    [previewFile],
  );

  // 파일이 바뀌거나 언마운트될 때 이전 URL을 해제한다 (원본에는 해제가 없어 누수였다)
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return { fileList, setFileList, uploadProps, previewUrl, getFiles };
}
