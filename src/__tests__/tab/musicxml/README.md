# MusicXML 4.0 schema

The W3C MusicXML 4.0 XSD (`musicxml.xsd`, with the `xml.xsd` and `xlink.xsd`
it imports), from [w3c/musicxml](https://github.com/w3c/musicxml/tree/v4.0/schema)
at tag `v4.0`, under the W3C Community Final Specification Agreement (see
`NOTICE.md`). `musicxml.test.ts` checks every exported file against it.

One change: the two `schemaLocation`s in `musicxml.xsd` point at the files
beside it instead of `http://www.musicxml.org/xsd/…`, so validation needs no
network.
