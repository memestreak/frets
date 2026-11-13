import { fittedSize, imageFiles, imageFromFile, MAX_IMAGE_EDGE } from '@/features/tab/chat/images';
import { fetchToolModels, knownBlind, MODELS_URL, wireMessages, type ChatMessage } from '@/features/tab/chat/openRouter';
import { IMAGES_ONLY_ASK, userContent } from '@/features/tab/chat/reply';

// `docs/specs/2026-11-13-tab-chat-images-design.md` (issue #465): images sent with a Chat ask.
const png = (name = 'image.png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

describe('images in a Chat ask', () => {
  it('sends an ask without images as plain text, and with images as the text then each image, in order', () => {
    expect(userContent('Hi', [])).toBe('Hi');
    expect(userContent('Transcribe', [{ url: 'data:image/png;base64,AA' }, { url: 'data:image/jpeg;base64,BB' }])).toEqual([
      { type: 'text', text: 'Transcribe' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BB' } },
    ]);
    expect(IMAGES_ONLY_ASK).toBe('Transcribe the attached image into the arrangement.');
  });

  it('sends a message with images as it is', () => {
    const asked: ChatMessage = { role: 'user', content: userContent('Hi', [{ url: 'data:image/png;base64,AA' }]) };
    expect(wireMessages([asked])).toEqual([asked]);
  });

  it('scales an image past 2048 pixels to 2048 on its longest side, and leaves a smaller one alone', () => {
    expect(MAX_IMAGE_EDGE).toBe(2048);
    expect(fittedSize(3000, 1000)).toEqual({ width: 2048, height: 683 });
    expect(fittedSize(1000, 4096)).toEqual({ width: 500, height: 2048 });
    expect(fittedSize(2048, 2048)).toEqual({ width: 2048, height: 2048 });
    expect(fittedSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('takes only image files', () => {
    const text = new File(['x'], 'notes.txt', { type: 'text/plain' });
    expect(imageFiles([text, png(), new File([], 'a.jpg', { type: 'image/jpeg' })]).map(f => f.name)).toEqual(['image.png', 'a.jpg']);
    expect(imageFiles(null)).toEqual([]);
  });

  it('reads a file as a data: URL, named by its file name but not by a paste\'s "image.png"', async () => {
    expect(await imageFromFile(png())).toEqual({ url: 'data:image/png;base64,iVBORw==', name: '' });
    expect((await imageFromFile(png('page 3.png'))).name).toBe('page 3.png');
  });
});

describe('which models read images', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads image input from OpenRouter\'s model list; a model without a list of inputs is taken to read them', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      expect(String(url)).toBe(MODELS_URL);
      return new Response(JSON.stringify({ data: [
        { id: 'b/sees', supported_parameters: ['tools'], architecture: { input_modalities: ['text', 'image'] } },
        { id: 'a/blind', supported_parameters: ['tools'], architecture: { input_modalities: ['text'] } },
        { id: 'c/unsaid', supported_parameters: ['tools'] },
        { id: 'd/no-tools', supported_parameters: [], architecture: { input_modalities: ['text', 'image'] } },
      ] }));
    }));
    const models = (await fetchToolModels())!;
    expect(models).toEqual([{ id: 'a/blind', images: false }, { id: 'b/sees', images: true }, { id: 'c/unsaid', images: true }]);
    expect(knownBlind('a/blind', models)).toBe(true);
    expect(knownBlind('b/sees', models)).toBe(false);
    // A preset, or a model not in the list, isn't known, so no ⚠.
    expect(knownBlind('@preset/default', models)).toBe(false);
    expect(knownBlind('a/blind', [])).toBe(false);
  });
});
