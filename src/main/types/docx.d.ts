declare module 'docx' {
  // 基本类型
  export class Document {
    sections: {
      properties: any;
      children: any[];
    }[];
    
    constructor(options: {
      sections: {
        properties: any;
        children: any[];
      }[];
    });
  }
  
  export class Paragraph {
    constructor(options: any);
  }
  
  export class TextRun {
    constructor(options: any);
  }
  
  export class Table {
    constructor(options: any);
  }
  
  export class TableRow {
    constructor(options: any);
  }
  
  export class TableCell {
    constructor(options: any);
  }
  
  export class Header {
    constructor(options: any);
  }
  
  export class Footer {
    constructor(options: any);
  }
  
  // ImageRun 类型
  export interface ImageRunOptions {
    data: Buffer | Uint8Array | ArrayBuffer;
    transformation: {
      width: number;
      height: number;
    };
    type?: string;
    fallback?: {
      data: Buffer | Uint8Array | ArrayBuffer;
      type: string;
    };
  }
  
  export class ImageRun {
    constructor(options: ImageRunOptions);
  }
  
  // 枚举类型
  export enum BorderStyle {
    SINGLE = 'single',
    DOUBLE = 'double',
    DASH = 'dash',
    DASH_DOT = 'dashDot',
    DASH_DOT_DOT = 'dashDotDot',
    DOT = 'dot',
    TRIPLE = 'triple',
    THICK_THIN_LARGE_GAP = 'thickThinLargeGap',
    THIN_THICK_LARGE_GAP = 'thinThickLargeGap',
    THIN_THICK_THIN_LARGE_GAP = 'thinThickThinLargeGap',
    THIN_THICK_MEDIUM_GAP = 'thinThickMediumGap',
    THICK_THIN_MEDIUM_GAP = 'thickThinMediumGap',
    THIN_THICK_THIN_MEDIUM_GAP = 'thinThickThinMediumGap',
    THIN_THICK_SMALL_GAP = 'thinThickSmallGap',
    THICK_THIN_SMALL_GAP = 'thickThinSmallGap',
    THIN_THICK_THIN_SMALL_GAP = 'thinThickThinSmallGap',
    NIL = 'nil',
    NONE = 'none'
  }
  
  export enum AlignmentType {
    START = 'start',
    CENTER = 'center',
    END = 'end',
    JUSTIFIED = 'both',
    JUSTIFIED_LOW = 'low',
    JUSTIFIED_HIGH = 'high',
    JUSTIFIED_MEDIUM = 'medium',
    DISTRIBUTED = 'distribute',
    LEFT = 'left',
    RIGHT = 'right',
    BOTH = 'both'
  }
  
  // Packer 类
  export class Packer {
    static toBuffer(document: Document): Promise<Buffer>;
  }
} 