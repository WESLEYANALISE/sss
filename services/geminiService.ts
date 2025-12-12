import { GoogleGenAI, Type } from "@google/genai";
import { BookData, BookPage } from "../types";
import { getPdfPageCount, extractImagesFromPdf } from "../utils/pdfUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper for delays
const delay =