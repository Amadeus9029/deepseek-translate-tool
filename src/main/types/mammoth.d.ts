declare module 'mammoth' {
  export interface ExtractRawTextOptions {
    path?: string;
    buffer?: Buffer;
  }

  export interface ExtractRawTextResult {
    value: string;
    messages: any[];
  }

  export interface ConvertToHtmlOptions {
    path?: string;
    buffer?: Buffer;
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    convertImage?: (image: ImageElement) => Promise<{ src: string; alt?: string; [key: string]: any }>;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
    transformDocument?: (document: any) => any;
  }

  export interface ConvertToHtmlResult {
    value: string;
    messages: any[];
  }

  export interface ImageElement {
    contentType: string;
    read: (encoding?: string) => Promise<string | Buffer>;
    readAsArrayBuffer: () => Promise<ArrayBuffer>;
    readAsBuffer: () => Promise<Buffer>;
    readAsBase64String: () => Promise<string>;
    altText?: string;
  }

  export const images: {
    imgElement: (func: (image: ImageElement) => Promise<{ src: string; alt?: string; [key: string]: any }>) => any;
    dataUri: any;
  };

  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
  export function convertToHtml(options: ConvertToHtmlOptions, conversionOptions?: ConvertToHtmlOptions): Promise<ConvertToHtmlResult>;
} 