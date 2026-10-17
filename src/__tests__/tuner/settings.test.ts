import { defaultTunerSettings, parseTunerSettings } from '@/components/tuner/settings';

describe('parseTunerSettings', () => {
  it('defaults to the dial and the acoustic guitar', () => {
    expect(defaultTunerSettings()).toEqual({ meter: 'dial', sound: 'acoustic' });
    expect(parseTunerSettings(null)).toEqual(defaultTunerSettings());
    expect(parseTunerSettings('strobe')).toEqual(defaultTunerSettings());
  });

  it('reads each field, keeping the default for anything unknown', () => {
    expect(parseTunerSettings({ meter: 'strobe', sound: 'piano' }))
      .toEqual({ meter: 'strobe', sound: 'piano' });
    expect(parseTunerSettings({ meter: 'needle', sound: 'kazoo' }))
      .toEqual(defaultTunerSettings());
  });
});
