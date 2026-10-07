// Generated. Do not edit.
import { AppsClient } from './index.ts';
import type { AppRef, CapabilityResult, JsonValue } from '../../app-contracts/src/index.ts';
export const catalog = [
  {
    "capabilityId": "apps.presentation.list_saved",
    "version": "1.0.0",
    "title": "listSaved",
    "description": "Shared component listSaved. Builds and drafts remain separate from explicit saved assets.",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "components": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "componentId": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "view": {
                "type": "object",
                "properties": {
                  "viewId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "ownerSessionId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1
                  },
                  "design": {},
                  "bindings": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "bindingId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "appId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "connectionId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "capabilityId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "capabilityMajor": {
                          "type": "integer",
                          "minimum": 1
                        },
                        "input": {},
                        "projection": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "datasetId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "refresh": {
                          "type": "object",
                          "properties": {
                            "mode": {
                              "enum": [
                                "manual",
                                "scheduled"
                              ]
                            },
                            "scheduleId": {
                              "type": "string",
                              "minLength": 1
                            }
                          },
                          "required": [
                            "mode"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "bindingId",
                        "appId",
                        "connectionId",
                        "capabilityId",
                        "capabilityMajor",
                        "input",
                        "projection",
                        "refresh"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "source": {
                    "type": "object",
                    "properties": {
                      "buildId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "directory": {
                        "type": "string",
                        "minLength": 1
                      },
                      "entry": {
                        "type": "string",
                        "minLength": 1
                      },
                      "files": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "thumbnail": {
                        "type": "string",
                        "minLength": 1
                      },
                      "preview": {
                        "type": "object",
                        "properties": {
                          "screenshotPath": {
                            "type": "string",
                            "minLength": 1
                          },
                          "reportPath": {
                            "type": "string",
                            "minLength": 1
                          },
                          "width": {
                            "type": "number"
                          },
                          "height": {
                            "type": "number"
                          },
                          "capturedAt": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "required": [
                          "screenshotPath",
                          "reportPath"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "required": [
                      "buildId",
                      "directory",
                      "entry",
                      "files"
                    ],
                    "additionalProperties": false
                  },
                  "createdAt": {
                    "type": "string",
                    "minLength": 1
                  },
                  "updatedAt": {
                    "type": "string",
                    "minLength": 1
                  },
                  "sourceComponentId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "baseRevision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "initialData": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "bindingId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "datasetId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "status": {
                          "enum": [
                            "ready",
                            "failed",
                            "unavailable",
                            "empty"
                          ]
                        }
                      },
                      "required": [
                        "bindingId",
                        "datasetId",
                        "status"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "viewId",
                  "ownerSessionId",
                  "title",
                  "design",
                  "bindings",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              },
              "userRequest": {
                "type": "string",
                "minLength": 1
              },
              "savedAt": {
                "type": "string",
                "minLength": 1
              },
              "legacyTemplate": {},
              "revisions": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "revision": {
                      "type": "integer",
                      "minimum": 1
                    },
                    "title": {
                      "type": "string",
                      "minLength": 1
                    },
                    "savedAt": {
                      "type": "string",
                      "minLength": 1
                    },
                    "buildId": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "revision",
                    "title",
                    "savedAt"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "componentId",
              "revision",
              "title",
              "view",
              "userRequest",
              "savedAt"
            ],
            "additionalProperties": false
          }
        },
        "assets": {
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "assetId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "kind": {
                    "const": "entry"
                  },
                  "entryKind": {
                    "enum": [
                      "data",
                      "component"
                    ]
                  },
                  "componentId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1
                  },
                  "binding": {
                    "type": "object",
                    "properties": {
                      "bindingId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "appId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "connectionId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "capabilityId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "capabilityMajor": {
                        "type": "integer",
                        "minimum": 1
                      },
                      "input": {},
                      "projection": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "datasetId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "refresh": {
                        "type": "object",
                        "properties": {
                          "mode": {
                            "enum": [
                              "manual",
                              "scheduled"
                            ]
                          },
                          "scheduleId": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "required": [
                          "mode"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "required": [
                      "bindingId",
                      "appId",
                      "connectionId",
                      "capabilityId",
                      "capabilityMajor",
                      "input",
                      "projection",
                      "refresh"
                    ],
                    "additionalProperties": false
                  },
                  "legacyBinding": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "minLength": 1
                      },
                      "datasetKey": {
                        "type": "string",
                        "minLength": 1
                      },
                      "fieldMap": {
                        "type": "object",
                        "additionalProperties": {
                          "type": "string"
                        }
                      },
                      "query": {
                        "type": "object",
                        "properties": {
                          "tool": {
                            "type": "string",
                            "minLength": 1
                          },
                          "params": {
                            "type": "object"
                          }
                        },
                        "required": [
                          "tool",
                          "params"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "required": [
                      "id",
                      "fieldMap"
                    ],
                    "additionalProperties": false
                  },
                  "legacyFieldOrder": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "userRequest": {
                    "type": "string",
                    "minLength": 1
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "order": {
                    "type": "integer"
                  }
                },
                "required": [
                  "assetId",
                  "kind",
                  "title",
                  "userRequest",
                  "pinned",
                  "order"
                ],
                "oneOf": [
                  {
                    "required": [
                      "binding"
                    ]
                  },
                  {
                    "required": [
                      "componentId"
                    ]
                  }
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "assetId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "kind": {
                    "const": "template"
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1
                  },
                  "description": {
                    "type": "string"
                  },
                  "design": {},
                  "bindings": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "bindingId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "appId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "connectionId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "capabilityId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "capabilityMajor": {
                          "type": "integer",
                          "minimum": 1
                        },
                        "input": {},
                        "projection": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "datasetId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "refresh": {
                          "type": "object",
                          "properties": {
                            "mode": {
                              "enum": [
                                "manual",
                                "scheduled"
                              ]
                            },
                            "scheduleId": {
                              "type": "string",
                              "minLength": 1
                            }
                          },
                          "required": [
                            "mode"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "bindingId",
                        "appId",
                        "connectionId",
                        "capabilityId",
                        "capabilityMajor",
                        "input",
                        "projection",
                        "refresh"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "source": {
                    "type": "object",
                    "properties": {
                      "buildId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "directory": {
                        "type": "string",
                        "minLength": 1
                      },
                      "entry": {
                        "type": "string",
                        "minLength": 1
                      },
                      "files": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "thumbnail": {
                        "type": "string",
                        "minLength": 1
                      },
                      "preview": {
                        "type": "object",
                        "properties": {
                          "screenshotPath": {
                            "type": "string",
                            "minLength": 1
                          },
                          "reportPath": {
                            "type": "string",
                            "minLength": 1
                          },
                          "width": {
                            "type": "number"
                          },
                          "height": {
                            "type": "number"
                          },
                          "capturedAt": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "required": [
                          "screenshotPath",
                          "reportPath"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "required": [
                      "buildId",
                      "directory",
                      "entry",
                      "files"
                    ],
                    "additionalProperties": false
                  },
                  "userRequest": {
                    "type": "string",
                    "minLength": 1
                  },
                  "savedAt": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "assetId",
                  "kind",
                  "title",
                  "design",
                  "bindings",
                  "userRequest"
                ],
                "additionalProperties": false
              }
            ]
          }
        }
      },
      "required": [
        "components",
        "assets"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_list_saved"
    ]
  },
  {
    "capabilityId": "apps.presentation.manage_saved",
    "version": "1.0.0",
    "title": "manageSaved",
    "description": "Shared component manageSaved. Builds and drafts remain separate from explicit saved assets.",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "kind": {
          "enum": [
            "component",
            "entry",
            "template"
          ]
        },
        "id": {
          "type": "string",
          "minLength": 1
        },
        "action": {
          "enum": [
            "rename",
            "delete",
            "pin",
            "reorder"
          ]
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "order": {
          "type": "integer"
        },
        "pinned": {
          "type": "boolean"
        }
      },
      "required": [
        "kind",
        "id",
        "action"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "componentId": {
              "type": "string",
              "minLength": 1
            },
            "revision": {
              "type": "integer",
              "minimum": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "view": {
              "type": "object",
              "properties": {
                "viewId": {
                  "type": "string",
                  "minLength": 1
                },
                "ownerSessionId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "title": {
                  "type": "string",
                  "minLength": 1
                },
                "design": {},
                "bindings": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "bindingId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "appId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "connectionId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "capabilityId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "capabilityMajor": {
                        "type": "integer",
                        "minimum": 1
                      },
                      "input": {},
                      "projection": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "datasetId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "refresh": {
                        "type": "object",
                        "properties": {
                          "mode": {
                            "enum": [
                              "manual",
                              "scheduled"
                            ]
                          },
                          "scheduleId": {
                            "type": "string",
                            "minLength": 1
                          }
                        },
                        "required": [
                          "mode"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "required": [
                      "bindingId",
                      "appId",
                      "connectionId",
                      "capabilityId",
                      "capabilityMajor",
                      "input",
                      "projection",
                      "refresh"
                    ],
                    "additionalProperties": false
                  }
                },
                "source": {
                  "type": "object",
                  "properties": {
                    "buildId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "directory": {
                      "type": "string",
                      "minLength": 1
                    },
                    "entry": {
                      "type": "string",
                      "minLength": 1
                    },
                    "files": {
                      "type": "array",
                      "items": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "thumbnail": {
                      "type": "string",
                      "minLength": 1
                    },
                    "preview": {
                      "type": "object",
                      "properties": {
                        "screenshotPath": {
                          "type": "string",
                          "minLength": 1
                        },
                        "reportPath": {
                          "type": "string",
                          "minLength": 1
                        },
                        "width": {
                          "type": "number"
                        },
                        "height": {
                          "type": "number"
                        },
                        "capturedAt": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "required": [
                        "screenshotPath",
                        "reportPath"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "buildId",
                    "directory",
                    "entry",
                    "files"
                  ],
                  "additionalProperties": false
                },
                "createdAt": {
                  "type": "string",
                  "minLength": 1
                },
                "updatedAt": {
                  "type": "string",
                  "minLength": 1
                },
                "sourceComponentId": {
                  "type": "string",
                  "minLength": 1
                },
                "baseRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "initialData": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "bindingId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "datasetId": {
                        "type": "string",
                        "minLength": 1
                      },
                      "status": {
                        "enum": [
                          "ready",
                          "failed",
                          "unavailable",
                          "empty"
                        ]
                      }
                    },
                    "required": [
                      "bindingId",
                      "datasetId",
                      "status"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "viewId",
                "ownerSessionId",
                "title",
                "design",
                "bindings",
                "createdAt",
                "updatedAt"
              ],
              "additionalProperties": false
            },
            "userRequest": {
              "type": "string",
              "minLength": 1
            },
            "savedAt": {
              "type": "string",
              "minLength": 1
            },
            "legacyTemplate": {},
            "revisions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1
                  },
                  "savedAt": {
                    "type": "string",
                    "minLength": 1
                  },
                  "buildId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "revision",
                  "title",
                  "savedAt"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "componentId",
            "revision",
            "title",
            "view",
            "userRequest",
            "savedAt"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "assetId": {
              "type": "string",
              "minLength": 1
            },
            "kind": {
              "const": "entry"
            },
            "entryKind": {
              "enum": [
                "data",
                "component"
              ]
            },
            "componentId": {
              "type": "string",
              "minLength": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "binding": {
              "type": "object",
              "properties": {
                "bindingId": {
                  "type": "string",
                  "minLength": 1
                },
                "appId": {
                  "type": "string",
                  "minLength": 1
                },
                "connectionId": {
                  "type": "string",
                  "minLength": 1
                },
                "capabilityId": {
                  "type": "string",
                  "minLength": 1
                },
                "capabilityMajor": {
                  "type": "integer",
                  "minimum": 1
                },
                "input": {},
                "projection": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "datasetId": {
                  "type": "string",
                  "minLength": 1
                },
                "refresh": {
                  "type": "object",
                  "properties": {
                    "mode": {
                      "enum": [
                        "manual",
                        "scheduled"
                      ]
                    },
                    "scheduleId": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "mode"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "bindingId",
                "appId",
                "connectionId",
                "capabilityId",
                "capabilityMajor",
                "input",
                "projection",
                "refresh"
              ],
              "additionalProperties": false
            },
            "legacyBinding": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1
                },
                "datasetKey": {
                  "type": "string",
                  "minLength": 1
                },
                "fieldMap": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                "query": {
                  "type": "object",
                  "properties": {
                    "tool": {
                      "type": "string",
                      "minLength": 1
                    },
                    "params": {
                      "type": "object"
                    }
                  },
                  "required": [
                    "tool",
                    "params"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "id",
                "fieldMap"
              ],
              "additionalProperties": false
            },
            "legacyFieldOrder": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "userRequest": {
              "type": "string",
              "minLength": 1
            },
            "pinned": {
              "type": "boolean"
            },
            "order": {
              "type": "integer"
            }
          },
          "required": [
            "assetId",
            "kind",
            "title",
            "userRequest",
            "pinned",
            "order"
          ],
          "oneOf": [
            {
              "required": [
                "binding"
              ]
            },
            {
              "required": [
                "componentId"
              ]
            }
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "assetId": {
              "type": "string",
              "minLength": 1
            },
            "kind": {
              "const": "template"
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "description": {
              "type": "string"
            },
            "design": {},
            "bindings": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "bindingId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "appId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "connectionId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "capabilityId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "capabilityMajor": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "input": {},
                  "projection": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "datasetId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "refresh": {
                    "type": "object",
                    "properties": {
                      "mode": {
                        "enum": [
                          "manual",
                          "scheduled"
                        ]
                      },
                      "scheduleId": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "mode"
                    ],
                    "additionalProperties": false
                  }
                },
                "required": [
                  "bindingId",
                  "appId",
                  "connectionId",
                  "capabilityId",
                  "capabilityMajor",
                  "input",
                  "projection",
                  "refresh"
                ],
                "additionalProperties": false
              }
            },
            "source": {
              "type": "object",
              "properties": {
                "buildId": {
                  "type": "string",
                  "minLength": 1
                },
                "directory": {
                  "type": "string",
                  "minLength": 1
                },
                "entry": {
                  "type": "string",
                  "minLength": 1
                },
                "files": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "thumbnail": {
                  "type": "string",
                  "minLength": 1
                },
                "preview": {
                  "type": "object",
                  "properties": {
                    "screenshotPath": {
                      "type": "string",
                      "minLength": 1
                    },
                    "reportPath": {
                      "type": "string",
                      "minLength": 1
                    },
                    "width": {
                      "type": "number"
                    },
                    "height": {
                      "type": "number"
                    },
                    "capturedAt": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "screenshotPath",
                    "reportPath"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "buildId",
                "directory",
                "entry",
                "files"
              ],
              "additionalProperties": false
            },
            "userRequest": {
              "type": "string",
              "minLength": 1
            },
            "savedAt": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "assetId",
            "kind",
            "title",
            "design",
            "bindings",
            "userRequest"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "deleted": {
              "const": true
            },
            "id": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "deleted",
            "id"
          ],
          "additionalProperties": false
        }
      ]
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_manage_saved"
    ]
  },
  {
    "capabilityId": "apps.presentation.open_component",
    "version": "1.0.0",
    "title": "openComponent",
    "description": "Shared component openComponent. Builds and drafts remain separate from explicit saved assets.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "componentId": {
          "type": "string",
          "minLength": 1
        },
        "revision": {
          "type": "integer",
          "minimum": 1
        },
        "directory": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "componentId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "ownerSessionId": {
          "type": [
            "string",
            "null"
          ]
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "design": {},
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        },
        "source": {
          "type": "object",
          "properties": {
            "buildId": {
              "type": "string",
              "minLength": 1
            },
            "directory": {
              "type": "string",
              "minLength": 1
            },
            "entry": {
              "type": "string",
              "minLength": 1
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "thumbnail": {
              "type": "string",
              "minLength": 1
            },
            "preview": {
              "type": "object",
              "properties": {
                "screenshotPath": {
                  "type": "string",
                  "minLength": 1
                },
                "reportPath": {
                  "type": "string",
                  "minLength": 1
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                },
                "capturedAt": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "screenshotPath",
                "reportPath"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "buildId",
            "directory",
            "entry",
            "files"
          ],
          "additionalProperties": false
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "updatedAt": {
          "type": "string",
          "minLength": 1
        },
        "sourceComponentId": {
          "type": "string",
          "minLength": 1
        },
        "baseRevision": {
          "type": "integer",
          "minimum": 1
        },
        "initialData": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "status": {
                "enum": [
                  "ready",
                  "failed",
                  "unavailable",
                  "empty"
                ]
              }
            },
            "required": [
              "bindingId",
              "datasetId",
              "status"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "viewId",
        "ownerSessionId",
        "title",
        "design",
        "bindings",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_open_component"
    ]
  },
  {
    "capabilityId": "apps.presentation.open_source_component",
    "version": "1.0.0",
    "title": "openSource",
    "description": "Shared component openSource. Builds and drafts remain separate from explicit saved assets.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "directory": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        },
        "legacyBindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "datasetKey": {
                "type": "string",
                "minLength": 1
              },
              "fieldMap": {
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              },
              "query": {
                "type": "object",
                "properties": {
                  "tool": {
                    "type": "string",
                    "minLength": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "tool",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "id",
              "fieldMap"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "directory"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "ownerSessionId": {
          "type": [
            "string",
            "null"
          ]
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "design": {},
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        },
        "source": {
          "type": "object",
          "properties": {
            "buildId": {
              "type": "string",
              "minLength": 1
            },
            "directory": {
              "type": "string",
              "minLength": 1
            },
            "entry": {
              "type": "string",
              "minLength": 1
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "thumbnail": {
              "type": "string",
              "minLength": 1
            },
            "preview": {
              "type": "object",
              "properties": {
                "screenshotPath": {
                  "type": "string",
                  "minLength": 1
                },
                "reportPath": {
                  "type": "string",
                  "minLength": 1
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                },
                "capturedAt": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "screenshotPath",
                "reportPath"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "buildId",
            "directory",
            "entry",
            "files"
          ],
          "additionalProperties": false
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "updatedAt": {
          "type": "string",
          "minLength": 1
        },
        "sourceComponentId": {
          "type": "string",
          "minLength": 1
        },
        "baseRevision": {
          "type": "integer",
          "minimum": 1
        },
        "initialData": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "status": {
                "enum": [
                  "ready",
                  "failed",
                  "unavailable",
                  "empty"
                ]
              }
            },
            "required": [
              "bindingId",
              "datasetId",
              "status"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "viewId",
        "ownerSessionId",
        "title",
        "design",
        "bindings",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_open_source_component"
    ]
  },
  {
    "capabilityId": "apps.presentation.render_view",
    "version": "1.0.0",
    "title": "renderView",
    "description": "Shared component renderView. Builds and drafts remain separate from explicit saved assets.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1
        },
        "design": {},
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        },
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "legacyViewId": {
          "type": "string",
          "minLength": 1
        },
        "templateId": {
          "type": "string",
          "minLength": 1
        },
        "directory": {
          "type": "string",
          "minLength": 1
        },
        "legacyBindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "datasetKey": {
                "type": "string",
                "minLength": 1
              },
              "fieldMap": {
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              },
              "query": {
                "type": "object",
                "properties": {
                  "tool": {
                    "type": "string",
                    "minLength": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "tool",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "id",
              "fieldMap"
            ],
            "additionalProperties": false
          }
        },
        "requiredBindingIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "legacyNeedsSpecification": {
          "type": "boolean"
        }
      },
      "required": [
        "title"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "ownerSessionId": {
          "type": [
            "string",
            "null"
          ]
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "design": {},
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        },
        "source": {
          "type": "object",
          "properties": {
            "buildId": {
              "type": "string",
              "minLength": 1
            },
            "directory": {
              "type": "string",
              "minLength": 1
            },
            "entry": {
              "type": "string",
              "minLength": 1
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "thumbnail": {
              "type": "string",
              "minLength": 1
            },
            "preview": {
              "type": "object",
              "properties": {
                "screenshotPath": {
                  "type": "string",
                  "minLength": 1
                },
                "reportPath": {
                  "type": "string",
                  "minLength": 1
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                },
                "capturedAt": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "screenshotPath",
                "reportPath"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "buildId",
            "directory",
            "entry",
            "files"
          ],
          "additionalProperties": false
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "updatedAt": {
          "type": "string",
          "minLength": 1
        },
        "sourceComponentId": {
          "type": "string",
          "minLength": 1
        },
        "baseRevision": {
          "type": "integer",
          "minimum": 1
        },
        "initialData": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "status": {
                "enum": [
                  "ready",
                  "failed",
                  "unavailable",
                  "empty"
                ]
              }
            },
            "required": [
              "bindingId",
              "datasetId",
              "status"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "viewId",
        "ownerSessionId",
        "title",
        "design",
        "bindings",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_render_view"
    ]
  },
  {
    "capabilityId": "apps.presentation.save_component",
    "version": "1.0.0",
    "title": "saveComponent",
    "description": "Shared component saveComponent. Builds and drafts remain separate from explicit saved assets.",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "userRequest": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "mode": {
          "enum": [
            "save_as",
            "update"
          ]
        },
        "componentId": {
          "type": "string",
          "minLength": 1
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 1
        },
        "legacyComponentId": {
          "type": "string",
          "minLength": 1
        },
        "legacyTemplate": {}
      },
      "required": [
        "viewId",
        "userRequest",
        "mode"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "componentId": {
          "type": "string",
          "minLength": 1
        },
        "revision": {
          "type": "integer",
          "minimum": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "view": {
          "type": "object",
          "properties": {
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "ownerSessionId": {
              "type": [
                "string",
                "null"
              ]
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "design": {},
            "bindings": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "bindingId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "appId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "connectionId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "capabilityId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "capabilityMajor": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "input": {},
                  "projection": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "datasetId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "refresh": {
                    "type": "object",
                    "properties": {
                      "mode": {
                        "enum": [
                          "manual",
                          "scheduled"
                        ]
                      },
                      "scheduleId": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "mode"
                    ],
                    "additionalProperties": false
                  }
                },
                "required": [
                  "bindingId",
                  "appId",
                  "connectionId",
                  "capabilityId",
                  "capabilityMajor",
                  "input",
                  "projection",
                  "refresh"
                ],
                "additionalProperties": false
              }
            },
            "source": {
              "type": "object",
              "properties": {
                "buildId": {
                  "type": "string",
                  "minLength": 1
                },
                "directory": {
                  "type": "string",
                  "minLength": 1
                },
                "entry": {
                  "type": "string",
                  "minLength": 1
                },
                "files": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "thumbnail": {
                  "type": "string",
                  "minLength": 1
                },
                "preview": {
                  "type": "object",
                  "properties": {
                    "screenshotPath": {
                      "type": "string",
                      "minLength": 1
                    },
                    "reportPath": {
                      "type": "string",
                      "minLength": 1
                    },
                    "width": {
                      "type": "number"
                    },
                    "height": {
                      "type": "number"
                    },
                    "capturedAt": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "screenshotPath",
                    "reportPath"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "buildId",
                "directory",
                "entry",
                "files"
              ],
              "additionalProperties": false
            },
            "createdAt": {
              "type": "string",
              "minLength": 1
            },
            "updatedAt": {
              "type": "string",
              "minLength": 1
            },
            "sourceComponentId": {
              "type": "string",
              "minLength": 1
            },
            "baseRevision": {
              "type": "integer",
              "minimum": 1
            },
            "initialData": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "bindingId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "datasetId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "status": {
                    "enum": [
                      "ready",
                      "failed",
                      "unavailable",
                      "empty"
                    ]
                  }
                },
                "required": [
                  "bindingId",
                  "datasetId",
                  "status"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "viewId",
            "ownerSessionId",
            "title",
            "design",
            "bindings",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        "userRequest": {
          "type": "string",
          "minLength": 1
        },
        "savedAt": {
          "type": "string",
          "minLength": 1
        },
        "legacyTemplate": {},
        "revisions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "savedAt": {
                "type": "string",
                "minLength": 1
              },
              "buildId": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "revision",
              "title",
              "savedAt"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "componentId",
        "revision",
        "title",
        "view",
        "userRequest",
        "savedAt"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_save_component"
    ]
  },
  {
    "capabilityId": "apps.presentation.save_entry",
    "version": "1.0.0",
    "title": "saveEntry",
    "description": "Shared component saveEntry. Builds and drafts remain separate from explicit saved assets.",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1
        },
        "binding": {
          "type": "object",
          "properties": {
            "bindingId": {
              "type": "string",
              "minLength": 1
            },
            "appId": {
              "type": "string",
              "minLength": 1
            },
            "connectionId": {
              "type": "string",
              "minLength": 1
            },
            "capabilityId": {
              "type": "string",
              "minLength": 1
            },
            "capabilityMajor": {
              "type": "integer",
              "minimum": 1
            },
            "input": {},
            "projection": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "datasetId": {
              "type": "string",
              "minLength": 1
            },
            "refresh": {
              "type": "object",
              "properties": {
                "mode": {
                  "enum": [
                    "manual",
                    "scheduled"
                  ]
                },
                "scheduleId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "mode"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "bindingId",
            "appId",
            "connectionId",
            "capabilityId",
            "capabilityMajor",
            "input",
            "projection",
            "refresh"
          ],
          "additionalProperties": false
        },
        "legacyBinding": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "datasetKey": {
              "type": "string",
              "minLength": 1
            },
            "fieldMap": {
              "type": "object",
              "additionalProperties": {
                "type": "string"
              }
            },
            "query": {
              "type": "object",
              "properties": {
                "tool": {
                  "type": "string",
                  "minLength": 1
                },
                "params": {
                  "type": "object"
                }
              },
              "required": [
                "tool",
                "params"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "fieldMap"
          ],
          "additionalProperties": false
        },
        "legacyFieldOrder": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "userRequest": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "title",
        "binding",
        "userRequest"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "assetId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "const": "entry"
        },
        "entryKind": {
          "enum": [
            "data",
            "component"
          ]
        },
        "componentId": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "binding": {
          "type": "object",
          "properties": {
            "bindingId": {
              "type": "string",
              "minLength": 1
            },
            "appId": {
              "type": "string",
              "minLength": 1
            },
            "connectionId": {
              "type": "string",
              "minLength": 1
            },
            "capabilityId": {
              "type": "string",
              "minLength": 1
            },
            "capabilityMajor": {
              "type": "integer",
              "minimum": 1
            },
            "input": {},
            "projection": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "datasetId": {
              "type": "string",
              "minLength": 1
            },
            "refresh": {
              "type": "object",
              "properties": {
                "mode": {
                  "enum": [
                    "manual",
                    "scheduled"
                  ]
                },
                "scheduleId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "mode"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "bindingId",
            "appId",
            "connectionId",
            "capabilityId",
            "capabilityMajor",
            "input",
            "projection",
            "refresh"
          ],
          "additionalProperties": false
        },
        "legacyBinding": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "datasetKey": {
              "type": "string",
              "minLength": 1
            },
            "fieldMap": {
              "type": "object",
              "additionalProperties": {
                "type": "string"
              }
            },
            "query": {
              "type": "object",
              "properties": {
                "tool": {
                  "type": "string",
                  "minLength": 1
                },
                "params": {
                  "type": "object"
                }
              },
              "required": [
                "tool",
                "params"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "fieldMap"
          ],
          "additionalProperties": false
        },
        "legacyFieldOrder": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "userRequest": {
          "type": "string",
          "minLength": 1
        },
        "pinned": {
          "type": "boolean"
        },
        "order": {
          "type": "integer"
        }
      },
      "required": [
        "assetId",
        "kind",
        "title",
        "userRequest",
        "pinned",
        "order"
      ],
      "oneOf": [
        {
          "required": [
            "binding"
          ]
        },
        {
          "required": [
            "componentId"
          ]
        }
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_save_entry"
    ]
  },
  {
    "capabilityId": "apps.presentation.save_template",
    "version": "1.0.0",
    "title": "saveTemplate",
    "description": "Shared component saveTemplate. Builds and drafts remain separate from explicit saved assets.",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "description": {
          "type": "string"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "viewId",
        "name",
        "userRequest"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "assetId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "const": "template"
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "description": {
          "type": "string"
        },
        "design": {},
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        },
        "source": {
          "type": "object",
          "properties": {
            "buildId": {
              "type": "string",
              "minLength": 1
            },
            "directory": {
              "type": "string",
              "minLength": 1
            },
            "entry": {
              "type": "string",
              "minLength": 1
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "thumbnail": {
              "type": "string",
              "minLength": 1
            },
            "preview": {
              "type": "object",
              "properties": {
                "screenshotPath": {
                  "type": "string",
                  "minLength": 1
                },
                "reportPath": {
                  "type": "string",
                  "minLength": 1
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                },
                "capturedAt": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "screenshotPath",
                "reportPath"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "buildId",
            "directory",
            "entry",
            "files"
          ],
          "additionalProperties": false
        },
        "userRequest": {
          "type": "string",
          "minLength": 1
        },
        "savedAt": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "assetId",
        "kind",
        "title",
        "design",
        "bindings",
        "userRequest"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_save_template"
    ]
  },
  {
    "capabilityId": "apps.presentation.update_view",
    "version": "1.0.0",
    "title": "updateView",
    "description": "Shared component updateView. Builds and drafts remain separate from explicit saved assets.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "design": {},
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "viewId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "ownerSessionId": {
          "type": [
            "string",
            "null"
          ]
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "design": {},
        "bindings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "appId": {
                "type": "string",
                "minLength": 1
              },
              "connectionId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityId": {
                "type": "string",
                "minLength": 1
              },
              "capabilityMajor": {
                "type": "integer",
                "minimum": 1
              },
              "input": {},
              "projection": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "refresh": {
                "type": "object",
                "properties": {
                  "mode": {
                    "enum": [
                      "manual",
                      "scheduled"
                    ]
                  },
                  "scheduleId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "bindingId",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "projection",
              "refresh"
            ],
            "additionalProperties": false
          }
        },
        "source": {
          "type": "object",
          "properties": {
            "buildId": {
              "type": "string",
              "minLength": 1
            },
            "directory": {
              "type": "string",
              "minLength": 1
            },
            "entry": {
              "type": "string",
              "minLength": 1
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "thumbnail": {
              "type": "string",
              "minLength": 1
            },
            "preview": {
              "type": "object",
              "properties": {
                "screenshotPath": {
                  "type": "string",
                  "minLength": 1
                },
                "reportPath": {
                  "type": "string",
                  "minLength": 1
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                },
                "capturedAt": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "screenshotPath",
                "reportPath"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "buildId",
            "directory",
            "entry",
            "files"
          ],
          "additionalProperties": false
        },
        "createdAt": {
          "type": "string",
          "minLength": 1
        },
        "updatedAt": {
          "type": "string",
          "minLength": 1
        },
        "sourceComponentId": {
          "type": "string",
          "minLength": 1
        },
        "baseRevision": {
          "type": "integer",
          "minimum": 1
        },
        "initialData": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "bindingId": {
                "type": "string",
                "minLength": 1
              },
              "datasetId": {
                "type": "string",
                "minLength": 1
              },
              "status": {
                "enum": [
                  "ready",
                  "failed",
                  "unavailable",
                  "empty"
                ]
              }
            },
            "required": [
              "bindingId",
              "datasetId",
              "status"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "viewId",
        "ownerSessionId",
        "title",
        "design",
        "bindings",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "component",
        "presentation",
        "source"
      ]
    },
    "aliases": [
      "hallmark_update_view"
    ]
  },
  {
    "capabilityId": "hallmark.api.actions.candidates",
    "version": "1.0.0",
    "title": "ozonActionCandidatesList",
    "description": "已登记接口 ozonActionCandidatesList；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonActionCandidatesList"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonActionCandidatesList"
  },
  {
    "capabilityId": "hallmark.api.actions.list",
    "version": "1.0.0",
    "title": "ozonActionsList",
    "description": "已登记接口 ozonActionsList；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonActionsList"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonActionsList"
  },
  {
    "capabilityId": "hallmark.api.actions.products",
    "version": "1.0.0",
    "title": "ozonActionProductsList",
    "description": "已登记接口 ozonActionProductsList；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonActionProductsList"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonActionProductsList"
  },
  {
    "capabilityId": "hallmark.api.category.read",
    "version": "1.0.0",
    "title": "hallmarkCategoryRead",
    "description": "已登记接口 hallmarkCategoryRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "mode": {
          "type": "string",
          "enum": [
            "search",
            "show",
            "template",
            "values",
            "validate_value",
            "sync"
          ]
        },
        "q": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "search必填；values可选；最多200个Unicode字符，不允许*"
        },
        "descriptionCategoryId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数类目ID"
        },
        "typeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数typeId"
        },
        "attributeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数属性ID"
        },
        "valueId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数字典值ID"
        },
        "dictionaryId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数字典ID"
        },
        "aspects": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "maxItems": 10
        },
        "requireAspects": {
          "type": "boolean"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        }
      },
      "required": [
        "mode"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "datasetKey": {
          "type": "string",
          "minLength": 1
        },
        "query": {
          "type": "object",
          "properties": {
            "tool": {
              "const": "hallmark_get_category_data"
            },
            "params": {
              "type": "object",
              "additionalProperties": true
            }
          },
          "required": [
            "tool",
            "params"
          ],
          "additionalProperties": false
        },
        "raw": {
          "type": "object",
          "additionalProperties": true
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "required": [
        "datasetKey",
        "query"
      ],
      "oneOf": [
        {
          "required": [
            "raw"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "hallmarkCategoryRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "hallmarkCategoryRead"
  },
  {
    "capabilityId": "hallmark.api.collected_item.raw",
    "version": "1.0.0",
    "title": "hallmarkCollectedItemRawRead",
    "description": "已登记接口 hallmarkCollectedItemRawRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "itemId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [
        "itemId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "content": {
          "type": "string"
        },
        "truncated": {
          "type": "boolean"
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "id",
            "content",
            "truncated"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "hallmarkCollectedItemRawRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "hallmarkCollectedItemRawRead"
  },
  {
    "capabilityId": "hallmark.api.products.attributes",
    "version": "1.0.0",
    "title": "ozonProductsAttributesRead",
    "description": "已登记接口 ozonProductsAttributesRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonProductsAttributesRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonProductsAttributesRead"
  },
  {
    "capabilityId": "hallmark.api.products.import_inspect",
    "version": "1.0.0",
    "title": "ozonProductImportInspect",
    "description": "已登记接口 ozonProductImportInspect；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonProductImportInspect"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonProductImportInspect"
  },
  {
    "capabilityId": "hallmark.api.products.info",
    "version": "1.0.0",
    "title": "ozonProductsInfoRead",
    "description": "已登记接口 ozonProductsInfoRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonProductsInfoRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonProductsInfoRead"
  },
  {
    "capabilityId": "hallmark.api.products.prices",
    "version": "1.0.0",
    "title": "ozonProductsPricesRead",
    "description": "已登记接口 ozonProductsPricesRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonProductsPricesRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonProductsPricesRead"
  },
  {
    "capabilityId": "hallmark.api.products.stocks",
    "version": "1.0.0",
    "title": "ozonProductStocksRead",
    "description": "已登记接口 ozonProductStocksRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonProductStocksRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonProductStocksRead"
  },
  {
    "capabilityId": "hallmark.api.products.update_price",
    "version": "1.0.0",
    "title": "hallmarkPriceUpdate",
    "description": "已登记的 Hallmark 普通调价适配操作，委托既有 WriteOperations 的输入核实、操作账本和只读 inspect；不是固定 URL 的直接调用。有已核实店铺任务时使用 task platform 调价并按同一商品、币种和金额回读；仅 TASK_CONTEXT_REQUIRED、CNY、无 actionId/oldPrice 且适配器具备普通 CNY 提交/读取/核实接口时，沿既有严格两位小数 CNY fallback。该 fallback 核实历史 price-state，不宣称实时平台回读。结果保留原请求编号、原始响应和 readback；unknown 仅查询原操作，不重发。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "offerIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "productIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "valueSource": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "user 或 rule:规则名，不允许猜测数值"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "同一逻辑修改必须复用；未知结果先查询操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "本轮用户明确修改指令原话"
        },
        "scopeConfirmed": {
          "type": "boolean"
        },
        "price": {
          "type": "number",
          "minimum": 0.01
        },
        "currency": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "oldPrice": {
          "type": "number"
        },
        "actionId": {
          "type": "integer",
          "minimum": 1
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "operationId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "type": "string",
          "minLength": 1
        },
        "storeId": {
          "type": "string"
        },
        "state": {
          "enum": [
            "pending",
            "running",
            "succeeded",
            "failed",
            "partial",
            "unknown"
          ]
        },
        "targets": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "input": {
          "type": "object",
          "additionalProperties": true
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        }
      },
      "required": [
        "operationId",
        "kind",
        "storeId",
        "state",
        "targets",
        "input",
        "items"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 120000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "hallmarkPriceUpdate"
      ]
    },
    "aliases": [],
    "apiOperationId": "hallmarkPriceUpdate"
  },
  {
    "capabilityId": "hallmark.api.store_products.read",
    "version": "1.0.0",
    "title": "hallmarkStoreProductsRead",
    "description": "已登记接口 hallmarkStoreProductsRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "products": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "stores": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "products",
            "stores"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "hallmarkStoreProductsRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "hallmarkStoreProductsRead"
  },
  {
    "capabilityId": "hallmark.api.store_products.sync",
    "version": "1.0.0",
    "title": "hallmarkStoreProductsSync",
    "description": "已登记接口 hallmarkStoreProductsSync；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "hallmarkStoreProductsSync"
      ]
    },
    "aliases": [],
    "apiOperationId": "hallmarkStoreProductsSync"
  },
  {
    "capabilityId": "hallmark.api.stores.list",
    "version": "1.0.0",
    "title": "hallmarkStoresList",
    "description": "已登记接口 hallmarkStoresList；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "storeId": {
            "type": "string",
            "minLength": 1
          },
          "store_id": {
            "type": "string",
            "minLength": 1
          }
        },
        "anyOf": [
          {
            "required": [
              "id"
            ]
          },
          {
            "required": [
              "storeId"
            ]
          },
          {
            "required": [
              "store_id"
            ]
          }
        ],
        "additionalProperties": true
      }
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "hallmarkStoresList"
      ]
    },
    "aliases": [],
    "apiOperationId": "hallmarkStoresList"
  },
  {
    "capabilityId": "hallmark.api.target_margin.read",
    "version": "1.0.0",
    "title": "hallmarkTargetMarginRead",
    "description": "已登记接口 hallmarkTargetMarginRead；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "hallmarkTargetMarginRead"
      ]
    },
    "aliases": [],
    "apiOperationId": "hallmarkTargetMarginRead"
  },
  {
    "capabilityId": "hallmark.api.warehouses.list",
    "version": "1.0.0",
    "title": "ozonWarehousesList",
    "description": "已登记接口 ozonWarehousesList；使用 Hallmark 原实现并保留请求/响应证据",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store": {
          "type": "string",
          "minLength": 1
        },
        "body": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "api",
        "ozonWarehousesList"
      ]
    },
    "aliases": [],
    "apiOperationId": "ozonWarehousesList"
  },
  {
    "capabilityId": "hallmark.app.info",
    "version": "1.0.0",
    "title": "hallmark_app_info",
    "description": "说明应用能力、边界、来源、保存规则与后端状态",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "appId": {
          "const": "hallmark"
        },
        "instructions": {
          "type": "string",
          "minLength": 1
        },
        "tools": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1
              },
              "kind": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "name",
              "kind"
            ],
            "additionalProperties": false
          }
        },
        "boundaries": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "required": [
        "appId",
        "instructions",
        "tools",
        "boundaries"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "hallmark",
        "app_info"
      ]
    },
    "aliases": [
      "hallmark_app_info"
    ]
  },
  {
    "capabilityId": "hallmark.categories.read",
    "version": "1.0.0",
    "title": "hallmark_get_category_data",
    "description": "读取明确店铺的类目。search必填q，limit默认10且不超过20；show/template必填descriptionCategoryId+typeId；values另需attributeId，limit默认50且不超过100，可选q至少2字；validate_value另需attributeId+valueId+dictionaryId；sync只传店铺和mode，同步只读类目缓存。禁止模式外字段。返回datasetKey和raw（过大则spill），快照payload为原文；ok仅代表读取成功，须保留partial/stale与未核实候选，不将候选当允许值",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "mode": {
          "type": "string",
          "enum": [
            "search",
            "show",
            "template",
            "values",
            "validate_value",
            "sync"
          ]
        },
        "q": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "search必填；values可选；最多200个Unicode字符，不允许*"
        },
        "descriptionCategoryId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数类目ID"
        },
        "typeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数typeId"
        },
        "attributeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数属性ID"
        },
        "valueId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数字典值ID"
        },
        "dictionaryId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "规范正整数字典ID"
        },
        "aspects": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "maxItems": 10
        },
        "requireAspects": {
          "type": "boolean"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        }
      },
      "required": [
        "mode"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "datasetKey": {
          "type": "string",
          "minLength": 1
        },
        "query": {
          "type": "object",
          "properties": {
            "tool": {
              "const": "hallmark_get_category_data"
            },
            "params": {
              "type": "object",
              "additionalProperties": true
            }
          },
          "required": [
            "tool",
            "params"
          ],
          "additionalProperties": false
        },
        "raw": {
          "type": "object",
          "additionalProperties": true
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "required": [
        "datasetKey",
        "query"
      ],
      "oneOf": [
        {
          "required": [
            "raw"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "get_category_data"
      ]
    },
    "aliases": [
      "hallmark_get_category_data"
    ]
  },
  {
    "capabilityId": "hallmark.collected.get",
    "version": "1.0.0",
    "title": "hallmark_get_collected_item",
    "description": "获取单个采集商品完整原始字段",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "itemId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [
        "itemId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "content": {
          "type": "string"
        },
        "truncated": {
          "type": "boolean"
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "id",
            "content",
            "truncated"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "get_collected_item"
      ]
    },
    "aliases": [
      "hallmark_get_collected_item"
    ]
  },
  {
    "capabilityId": "hallmark.collected.search",
    "version": "1.0.0",
    "title": "hallmark_search_collected_items",
    "description": "搜索浏览器扩展已有采集摘要，不触发采集。返回items、分页cursor及可直接绑定组件的datasetKey；保留源返回顺序，不保证按采集时间排序；没有时间证据不声称最近。已保存组件可按同一查询与分页范围只读刷新",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        },
        "query": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "datasetKey": {
              "type": "string",
              "minLength": 1
            },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": true
              }
            },
            "total": {
              "type": "integer",
              "minimum": 0
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "datasetKey",
            "items",
            "total"
          ],
          "additionalProperties": true
        },
        {
          "type": "object",
          "properties": {
            "datasetKey": {
              "type": "string",
              "minLength": 1
            },
            "spill": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                },
                "summary": {
                  "type": "object",
                  "additionalProperties": true
                },
                "cursor": {
                  "type": "string"
                }
              },
              "required": [
                "path",
                "bytes",
                "summary",
                "cursor"
              ],
              "additionalProperties": true
            },
            "total": {
              "type": "integer",
              "minimum": 0
            },
            "cursor": {
              "type": "string"
            },
            "limit": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "datasetKey",
            "spill",
            "total",
            "cursor",
            "limit"
          ],
          "additionalProperties": true
        }
      ]
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "search_collected_items"
      ]
    },
    "aliases": [
      "hallmark_search_collected_items"
    ]
  },
  {
    "capabilityId": "hallmark.datasets.refresh",
    "version": "1.0.0",
    "title": "hallmark_refresh_data",
    "description": "只读同步并更新快照，不上品/调价/改库存或触发扩展采集",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "datasetKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "datasetKey": {
          "type": "string",
          "minLength": 1
        },
        "snapshot": {
          "type": "object",
          "additionalProperties": true
        },
        "counts": {
          "type": "object",
          "additionalProperties": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "required": [
        "datasetKey",
        "snapshot",
        "counts"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "refresh_data"
      ]
    },
    "aliases": [
      "hallmark_refresh_data"
    ]
  },
  {
    "capabilityId": "hallmark.datasets.status",
    "version": "1.0.0",
    "title": "hallmark_get_data_status",
    "description": "查询数据集上次成功时间、刷新状态与错误",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "datasetKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "datasetKey": {
          "type": "string",
          "minLength": 1
        },
        "state": {
          "type": "string",
          "minLength": 1
        },
        "lastSuccessAt": {
          "type": [
            "string",
            "null"
          ]
        },
        "lastError": {}
      },
      "required": [
        "datasetKey",
        "state",
        "lastSuccessAt",
        "lastError"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "get_data_status"
      ]
    },
    "aliases": [
      "hallmark_get_data_status"
    ]
  },
  {
    "capabilityId": "hallmark.operations.get",
    "version": "1.0.0",
    "title": "hallmark_get_operation",
    "description": "读取写入/刷新状态；unknown 时必须先查询，禁止自动重写",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "operationId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [
        "operationId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "operationId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "type": "string",
          "minLength": 1
        },
        "storeId": {
          "type": "string"
        },
        "state": {
          "enum": [
            "pending",
            "running",
            "succeeded",
            "failed",
            "partial",
            "unknown"
          ]
        },
        "targets": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "input": {
          "type": "object",
          "additionalProperties": true
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        }
      },
      "required": [
        "operationId",
        "kind",
        "storeId",
        "state",
        "targets",
        "input",
        "items"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "get_operation"
      ]
    },
    "aliases": [
      "hallmark_get_operation"
    ]
  },
  {
    "capabilityId": "hallmark.operations.list",
    "version": "1.0.0",
    "title": "hallmark_list_operations",
    "description": "按当前会话、店铺和时间读取操作记录",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "since": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "operationId": {
            "type": "string",
            "minLength": 1
          },
          "kind": {
            "type": "string",
            "minLength": 1
          },
          "storeId": {
            "type": "string"
          },
          "state": {
            "enum": [
              "pending",
              "running",
              "succeeded",
              "failed",
              "partial",
              "unknown"
            ]
          },
          "targets": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "input": {
            "type": "object",
            "additionalProperties": true
          },
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": true
            }
          }
        },
        "required": [
          "operationId",
          "kind",
          "storeId",
          "state",
          "targets",
          "input",
          "items"
        ],
        "additionalProperties": true
      }
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "list_operations"
      ]
    },
    "aliases": [
      "hallmark_list_operations"
    ]
  },
  {
    "capabilityId": "hallmark.platform.read",
    "version": "1.0.0",
    "title": "hallmark_get_platform_data",
    "description": "仅对白名单只读平台端点调用，自动关联内部任务",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "path": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "method": {
          "type": "string",
          "enum": [
            "GET",
            "POST"
          ]
        },
        "body": {
          "type": "object"
        }
      },
      "required": [
        "path"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "response": {},
        "httpStatus": {
          "type": "integer"
        },
        "outcome": {
          "enum": [
            "pending",
            "response_received",
            "outcome_unknown"
          ]
        },
        "spill": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "summary": {
              "type": "object",
              "additionalProperties": true
            },
            "cursor": {
              "type": "string"
            }
          },
          "required": [
            "path",
            "bytes",
            "summary",
            "cursor"
          ],
          "additionalProperties": true
        }
      },
      "anyOf": [
        {
          "required": [
            "response"
          ]
        },
        {
          "required": [
            "spill"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "get_platform_data"
      ]
    },
    "aliases": [
      "hallmark_get_platform_data"
    ]
  },
  {
    "capabilityId": "hallmark.products.filter",
    "version": "1.0.0",
    "title": "hallmark_filter_products",
    "description": "按参考利润率/价格/库存筛选，缺成本无法判断；结果集保留 24h",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "minMargin": {
          "type": "number"
        },
        "maxMargin": {
          "type": "number"
        },
        "minPrice": {
          "type": "number"
        },
        "maxPrice": {
          "type": "number"
        },
        "minStock": {
          "type": "number"
        },
        "maxStock": {
          "type": "number"
        },
        "status": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "resultSetId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "resultSetId": {
          "type": "string",
          "minLength": 1
        },
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time"
        },
        "payload": {
          "type": "object",
          "properties": {
            "products": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": true
              }
            },
            "unable": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": true
              }
            },
            "total": {
              "type": "integer",
              "minimum": 0
            },
            "matchedCount": {
              "type": "integer",
              "minimum": 0
            },
            "unableCount": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "total"
          ],
          "anyOf": [
            {
              "required": [
                "products",
                "unable"
              ]
            },
            {
              "required": [
                "matchedCount",
                "unableCount"
              ]
            }
          ],
          "additionalProperties": true
        }
      },
      "required": [
        "resultSetId",
        "storeId",
        "expiresAt",
        "payload"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "filter_products"
      ]
    },
    "aliases": [
      "hallmark_filter_products"
    ]
  },
  {
    "capabilityId": "hallmark.products.list",
    "version": "1.0.0",
    "title": "hallmark_list_store_products",
    "description": "读取店铺商品最近快照，保留原始源字段与时间",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "cursor": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        },
        "query": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "products": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": true
              }
            },
            "total": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "products",
            "total"
          ],
          "additionalProperties": true
        },
        {
          "type": "object",
          "properties": {
            "spill": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                },
                "summary": {
                  "type": "object",
                  "additionalProperties": true
                },
                "cursor": {
                  "type": "string"
                }
              },
              "required": [
                "path",
                "bytes",
                "summary",
                "cursor"
              ],
              "additionalProperties": true
            },
            "storeId": {
              "type": "string",
              "minLength": 1
            },
            "total": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "spill",
            "storeId",
            "total"
          ],
          "additionalProperties": true
        }
      ]
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "hallmark",
        "list_store_products"
      ]
    },
    "aliases": [
      "hallmark_list_store_products"
    ]
  },
  {
    "capabilityId": "hallmark.products.list_product",
    "version": "1.0.0",
    "title": "hallmark_list_product",
    "description": "仅上品用户指定的已有采集商品和 SKU 范围，不隐式全采集箱。仅在用户本轮明确要求修改时调用；缺信息必须澄清；unknown 禁止再次写入，先查询操作。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "offerIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "productIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "valueSource": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "user 或 rule:规则名，不允许猜测数值"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "同一逻辑修改必须复用；未知结果先查询操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "本轮用户明确修改指令原话"
        },
        "scopeConfirmed": {
          "type": "boolean"
        },
        "collectedItemId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "skuScope": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "importItems": {
          "type": "array",
          "items": {
            "type": "object"
          },
          "minItems": 1,
          "maxItems": 100
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "operationId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "type": "string",
          "minLength": 1
        },
        "storeId": {
          "type": "string"
        },
        "state": {
          "enum": [
            "pending",
            "running",
            "succeeded",
            "failed",
            "partial",
            "unknown"
          ]
        },
        "targets": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "input": {
          "type": "object",
          "additionalProperties": true
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        }
      },
      "required": [
        "operationId",
        "kind",
        "storeId",
        "state",
        "targets",
        "input",
        "items"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 120000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "list_product"
      ]
    },
    "aliases": [
      "hallmark_list_product"
    ]
  },
  {
    "capabilityId": "hallmark.products.update_price",
    "version": "1.0.0",
    "title": "hallmark_update_price",
    "description": "修改显式商品清单的价格并只读核实。仅在用户本轮明确要求修改时调用；缺信息必须澄清；unknown 禁止再次写入，先查询操作。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "offerIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "productIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "valueSource": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "user 或 rule:规则名，不允许猜测数值"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "同一逻辑修改必须复用；未知结果先查询操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "本轮用户明确修改指令原话"
        },
        "scopeConfirmed": {
          "type": "boolean"
        },
        "price": {
          "type": "number",
          "minimum": 0.01
        },
        "currency": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "oldPrice": {
          "type": "number"
        },
        "actionId": {
          "type": "integer",
          "minimum": 1
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "operationId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "type": "string",
          "minLength": 1
        },
        "storeId": {
          "type": "string"
        },
        "state": {
          "enum": [
            "pending",
            "running",
            "succeeded",
            "failed",
            "partial",
            "unknown"
          ]
        },
        "targets": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "input": {
          "type": "object",
          "additionalProperties": true
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        }
      },
      "required": [
        "operationId",
        "kind",
        "storeId",
        "state",
        "targets",
        "input",
        "items"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 120000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "update_price"
      ]
    },
    "aliases": [
      "hallmark_update_price"
    ]
  },
  {
    "capabilityId": "hallmark.products.update_stock",
    "version": "1.0.0",
    "title": "hallmark_update_stock",
    "description": "修改显式商品清单在指定仓库的库存并只读核实。仅在用户本轮明确要求修改时调用；缺信息必须澄清；unknown 禁止再次写入，先查询操作。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "offerIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "productIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "valueSource": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "user 或 rule:规则名，不允许猜测数值"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "同一逻辑修改必须复用；未知结果先查询操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "本轮用户明确修改指令原话"
        },
        "scopeConfirmed": {
          "type": "boolean"
        },
        "stock": {
          "type": "integer",
          "minimum": 0
        },
        "warehouseId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "operationId": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "type": "string",
          "minLength": 1
        },
        "storeId": {
          "type": "string"
        },
        "state": {
          "enum": [
            "pending",
            "running",
            "succeeded",
            "failed",
            "partial",
            "unknown"
          ]
        },
        "targets": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "input": {
          "type": "object",
          "additionalProperties": true
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        }
      },
      "required": [
        "operationId",
        "kind",
        "storeId",
        "state",
        "targets",
        "input",
        "items"
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 120000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "update_stock"
      ]
    },
    "aliases": [
      "hallmark_update_stock"
    ]
  },
  {
    "capabilityId": "hallmark.profit.compute",
    "version": "1.0.0",
    "title": "hallmark_compute_profit",
    "description": "调用 Hallmark 参考利润计算；并非实际结算，缺成本单列",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "用户明确指定的店铺 ID"
        },
        "store": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "名称/别名，匹配不唯一须澄清"
        },
        "offerIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        },
        "productIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4000
          },
          "minItems": 1,
          "maxItems": 200
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "products": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": true
              }
            },
            "total": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "products",
            "total"
          ],
          "additionalProperties": true
        },
        {
          "type": "object",
          "properties": {
            "spill": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                },
                "summary": {
                  "type": "object",
                  "additionalProperties": true
                },
                "cursor": {
                  "type": "string"
                }
              },
              "required": [
                "path",
                "bytes",
                "summary",
                "cursor"
              ],
              "additionalProperties": true
            },
            "storeId": {
              "type": "string",
              "minLength": 1
            },
            "total": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "spill",
            "storeId",
            "total"
          ],
          "additionalProperties": true
        }
      ]
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "compute_profit"
      ]
    },
    "aliases": [
      "hallmark_compute_profit"
    ]
  },
  {
    "capabilityId": "hallmark.stores.list",
    "version": "1.0.0",
    "title": "hallmark_list_stores",
    "description": "列出已配置店铺，保留原始字段",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "storeId": {
            "type": "string",
            "minLength": 1
          },
          "store_id": {
            "type": "string",
            "minLength": 1
          }
        },
        "anyOf": [
          {
            "required": [
              "id"
            ]
          },
          {
            "required": [
              "storeId"
            ]
          },
          {
            "required": [
              "store_id"
            ]
          }
        ],
        "additionalProperties": true
      }
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "hallmark",
        "list_stores"
      ]
    },
    "aliases": [
      "hallmark_list_stores"
    ]
  },
  {
    "capabilityId": "hallmark.stores.resolve",
    "version": "1.0.0",
    "title": "hallmark_resolve_store",
    "description": "唯一解析店铺；多个返回候选",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "store_id": {
          "type": "string",
          "minLength": 1
        }
      },
      "anyOf": [
        {
          "required": [
            "id"
          ]
        },
        {
          "required": [
            "storeId"
          ]
        },
        {
          "required": [
            "store_id"
          ]
        }
      ],
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 60000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "hallmark",
        "resolve_store"
      ]
    },
    "aliases": [
      "hallmark_resolve_store"
    ]
  },
  {
    "capabilityId": "notes.notes.create",
    "version": "1.0.0",
    "title": "Notes create",
    "description": "create 本地 Notes 原始笔记；按精确连接与资源身份执行。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "content": {
          "type": "string",
          "maxLength": 1000000
        }
      },
      "required": [
        "title",
        "content"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "note": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "content": {
              "type": "string",
              "maxLength": 1000000
            },
            "revision": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          },
          "required": [
            "id",
            "title",
            "content",
            "revision",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        "resource": {
          "type": "object",
          "properties": {
            "appId": {
              "const": "notes"
            },
            "connectionId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "resourceType": {
              "const": "note"
            },
            "resourceId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "revision": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            }
          },
          "required": [
            "appId",
            "connectionId",
            "resourceType",
            "resourceId",
            "revision"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "note",
        "resource"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 10000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "notes",
        "create"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "notes.notes.get",
    "version": "1.0.0",
    "title": "Notes get",
    "description": "get 本地 Notes 原始笔记；按精确连接与资源身份执行。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "note": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "content": {
              "type": "string",
              "maxLength": 1000000
            },
            "revision": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          },
          "required": [
            "id",
            "title",
            "content",
            "revision",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        "resource": {
          "type": "object",
          "properties": {
            "appId": {
              "const": "notes"
            },
            "connectionId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "resourceType": {
              "const": "note"
            },
            "resourceId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "revision": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            }
          },
          "required": [
            "appId",
            "connectionId",
            "resourceType",
            "resourceId",
            "revision"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "note",
        "resource"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 10000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "notes",
        "get"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "notes.notes.list",
    "version": "1.0.0",
    "title": "Notes list",
    "description": "list 本地 Notes 原始笔记；按精确连接与资源身份执行。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "maxLength": 4000
        },
        "cursor": {
          "type": "string",
          "pattern": "^(0|[1-9][0-9]*)$"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "note": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 4000
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 4000
                  },
                  "content": {
                    "type": "string",
                    "maxLength": 1000000
                  },
                  "revision": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$"
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "updatedAt": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "id",
                  "title",
                  "content",
                  "revision",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              },
              "resource": {
                "type": "object",
                "properties": {
                  "appId": {
                    "const": "notes"
                  },
                  "connectionId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 4000
                  },
                  "resourceType": {
                    "const": "note"
                  },
                  "resourceId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 4000
                  },
                  "revision": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 4000
                  }
                },
                "required": [
                  "appId",
                  "connectionId",
                  "resourceType",
                  "resourceId",
                  "revision"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "note",
              "resource"
            ],
            "additionalProperties": false
          }
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "returned": {
          "type": "integer",
          "minimum": 0
        },
        "nextCursor": {
          "type": [
            "string",
            "null"
          ]
        },
        "completeness": {
          "enum": [
            "complete",
            "partial"
          ]
        }
      },
      "required": [
        "items",
        "total",
        "returned",
        "nextCursor",
        "completeness"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 10000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "notes",
        "list"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "notes.notes.update",
    "version": "1.0.0",
    "title": "Notes update",
    "description": "update 本地 Notes 原始笔记；按精确连接与资源身份执行。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "content": {
          "type": "string",
          "maxLength": 1000000
        }
      },
      "required": [
        "id"
      ],
      "anyOf": [
        {
          "required": [
            "title"
          ]
        },
        {
          "required": [
            "content"
          ]
        }
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "note": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "content": {
              "type": "string",
              "maxLength": 1000000
            },
            "revision": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          },
          "required": [
            "id",
            "title",
            "content",
            "revision",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        "resource": {
          "type": "object",
          "properties": {
            "appId": {
              "const": "notes"
            },
            "connectionId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "resourceType": {
              "const": "note"
            },
            "resourceId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "revision": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            }
          },
          "required": [
            "appId",
            "connectionId",
            "resourceType",
            "resourceId",
            "revision"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "note",
        "resource"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 10000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "runtime_dedup",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "notes",
        "update"
      ]
    },
    "aliases": []
  }
] as const;
export type Input0 = {  };
export type Output0 = { "components": Array<{ "componentId": string; "revision": number; "title": string; "view": { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> }; "userRequest": string; "savedAt": string; "legacyTemplate"?: JsonValue; "revisions"?: Array<{ "revision": number; "title": string; "savedAt": string; "buildId"?: string }> }>; "assets": Array<JsonValue | JsonValue | { "assetId": string; "kind": "template"; "title": string; "description"?: string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "userRequest": string; "savedAt"?: string }> };
export function call0(client: AppsClient, ref: AppRef, input: Input0, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output0>> { return client.invoke(ref, catalog[0], input as JsonValue, options) as Promise<CapabilityResult<Output0>>; }

export type Input1 = { "kind": "component" | "entry" | "template"; "id": string; "action": "rename" | "delete" | "pin" | "reorder"; "name"?: string; "order"?: number; "pinned"?: boolean };
export type Output1 = { "componentId": string; "revision": number; "title": string; "view": { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> }; "userRequest": string; "savedAt": string; "legacyTemplate"?: JsonValue; "revisions"?: Array<{ "revision": number; "title": string; "savedAt": string; "buildId"?: string }> } | JsonValue | JsonValue | { "assetId": string; "kind": "template"; "title": string; "description"?: string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "userRequest": string; "savedAt"?: string } | { "deleted": true; "id": string };
export function call1(client: AppsClient, ref: AppRef, input: Input1, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output1>> { return client.invoke(ref, catalog[1], input as JsonValue, options) as Promise<CapabilityResult<Output1>>; }

export type Input2 = { "componentId": string; "revision"?: number; "directory"?: string };
export type Output2 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call2(client: AppsClient, ref: AppRef, input: Input2, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output2>> { return client.invoke(ref, catalog[2], input as JsonValue, options) as Promise<CapabilityResult<Output2>>; }

export type Input3 = { "directory": string; "title"?: string; "viewId"?: string; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "legacyBindings"?: Array<{ "id": string; "datasetKey"?: string; "fieldMap": ({  } & { [key: string]: JsonValue }); "query"?: { "tool": string; "params": ({  } & { [key: string]: JsonValue }) } }> };
export type Output3 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call3(client: AppsClient, ref: AppRef, input: Input3, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output3>> { return client.invoke(ref, catalog[3], input as JsonValue, options) as Promise<CapabilityResult<Output3>>; }

export type Input4 = { "title": string; "design"?: JsonValue; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "viewId"?: string; "legacyViewId"?: string; "templateId"?: string; "directory"?: string; "legacyBindings"?: Array<{ "id": string; "datasetKey"?: string; "fieldMap": ({  } & { [key: string]: JsonValue }); "query"?: { "tool": string; "params": ({  } & { [key: string]: JsonValue }) } }>; "requiredBindingIds"?: Array<string>; "legacyNeedsSpecification"?: boolean };
export type Output4 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call4(client: AppsClient, ref: AppRef, input: Input4, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output4>> { return client.invoke(ref, catalog[4], input as JsonValue, options) as Promise<CapabilityResult<Output4>>; }

export type Input5 = { "viewId": string; "userRequest": string; "title"?: string; "mode": "save_as" | "update"; "componentId"?: string; "expectedRevision"?: number; "legacyComponentId"?: string; "legacyTemplate"?: JsonValue };
export type Output5 = { "componentId": string; "revision": number; "title": string; "view": { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> }; "userRequest": string; "savedAt": string; "legacyTemplate"?: JsonValue; "revisions"?: Array<{ "revision": number; "title": string; "savedAt": string; "buildId"?: string }> };
export function call5(client: AppsClient, ref: AppRef, input: Input5, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output5>> { return client.invoke(ref, catalog[5], input as JsonValue, options) as Promise<CapabilityResult<Output5>>; }

export type Input6 = { "title": string; "binding": { "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }; "legacyBinding"?: { "id": string; "datasetKey"?: string; "fieldMap": ({  } & { [key: string]: JsonValue }); "query"?: { "tool": string; "params": ({  } & { [key: string]: JsonValue }) } }; "legacyFieldOrder"?: Array<string>; "userRequest": string };
export type Output6 = JsonValue | JsonValue;
export function call6(client: AppsClient, ref: AppRef, input: Input6, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output6>> { return client.invoke(ref, catalog[6], input as JsonValue, options) as Promise<CapabilityResult<Output6>>; }

export type Input7 = { "viewId": string; "name": string; "description"?: string; "userRequest": string };
export type Output7 = { "assetId": string; "kind": "template"; "title": string; "description"?: string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "userRequest": string; "savedAt"?: string };
export function call7(client: AppsClient, ref: AppRef, input: Input7, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output7>> { return client.invoke(ref, catalog[7], input as JsonValue, options) as Promise<CapabilityResult<Output7>>; }

export type Input8 = { "viewId": string; "title"?: string; "design"?: JsonValue; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }> };
export type Output8 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call8(client: AppsClient, ref: AppRef, input: Input8, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output8>> { return client.invoke(ref, catalog[8], input as JsonValue, options) as Promise<CapabilityResult<Output8>>; }

export type Input9 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output9 = JsonValue | JsonValue;
export function call9(client: AppsClient, ref: AppRef, input: Input9, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output9>> { return client.invoke(ref, catalog[9], input as JsonValue, options) as Promise<CapabilityResult<Output9>>; }

export type Input10 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output10 = JsonValue | JsonValue;
export function call10(client: AppsClient, ref: AppRef, input: Input10, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output10>> { return client.invoke(ref, catalog[10], input as JsonValue, options) as Promise<CapabilityResult<Output10>>; }

export type Input11 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output11 = JsonValue | JsonValue;
export function call11(client: AppsClient, ref: AppRef, input: Input11, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output11>> { return client.invoke(ref, catalog[11], input as JsonValue, options) as Promise<CapabilityResult<Output11>>; }

export type Input12 = { "storeId"?: string; "store"?: string; "mode": "search" | "show" | "template" | "values" | "validate_value" | "sync"; "q"?: string; "descriptionCategoryId"?: string; "typeId"?: string; "attributeId"?: string; "valueId"?: string; "dictionaryId"?: string; "aspects"?: Array<string>; "requireAspects"?: boolean; "limit"?: number };
export type Output12 = JsonValue | JsonValue;
export function call12(client: AppsClient, ref: AppRef, input: Input12, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output12>> { return client.invoke(ref, catalog[12], input as JsonValue, options) as Promise<CapabilityResult<Output12>>; }

export type Input13 = { "itemId": string };
export type Output13 = JsonValue | JsonValue;
export function call13(client: AppsClient, ref: AppRef, input: Input13, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output13>> { return client.invoke(ref, catalog[13], input as JsonValue, options) as Promise<CapabilityResult<Output13>>; }

export type Input14 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output14 = JsonValue | JsonValue;
export function call14(client: AppsClient, ref: AppRef, input: Input14, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output14>> { return client.invoke(ref, catalog[14], input as JsonValue, options) as Promise<CapabilityResult<Output14>>; }

export type Input15 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output15 = JsonValue | JsonValue;
export function call15(client: AppsClient, ref: AppRef, input: Input15, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output15>> { return client.invoke(ref, catalog[15], input as JsonValue, options) as Promise<CapabilityResult<Output15>>; }

export type Input16 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output16 = JsonValue | JsonValue;
export function call16(client: AppsClient, ref: AppRef, input: Input16, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output16>> { return client.invoke(ref, catalog[16], input as JsonValue, options) as Promise<CapabilityResult<Output16>>; }

export type Input17 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output17 = JsonValue | JsonValue;
export function call17(client: AppsClient, ref: AppRef, input: Input17, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output17>> { return client.invoke(ref, catalog[17], input as JsonValue, options) as Promise<CapabilityResult<Output17>>; }

export type Input18 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output18 = JsonValue | JsonValue;
export function call18(client: AppsClient, ref: AppRef, input: Input18, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output18>> { return client.invoke(ref, catalog[18], input as JsonValue, options) as Promise<CapabilityResult<Output18>>; }

export type Input19 = { "storeId"?: string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "price"?: number; "currency"?: string; "oldPrice"?: number; "actionId"?: number };
export type Output19 = ({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue });
export function call19(client: AppsClient, ref: AppRef, input: Input19, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output19>> { return client.invoke(ref, catalog[19], input as JsonValue, options) as Promise<CapabilityResult<Output19>>; }

export type Input20 = {  };
export type Output20 = JsonValue | JsonValue;
export function call20(client: AppsClient, ref: AppRef, input: Input20, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output20>> { return client.invoke(ref, catalog[20], input as JsonValue, options) as Promise<CapabilityResult<Output20>>; }

export type Input21 = {  };
export type Output21 = ({  } & { [key: string]: JsonValue });
export function call21(client: AppsClient, ref: AppRef, input: Input21, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output21>> { return client.invoke(ref, catalog[21], input as JsonValue, options) as Promise<CapabilityResult<Output21>>; }

export type Input22 = {  };
export type Output22 = Array<JsonValue | JsonValue | JsonValue>;
export function call22(client: AppsClient, ref: AppRef, input: Input22, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output22>> { return client.invoke(ref, catalog[22], input as JsonValue, options) as Promise<CapabilityResult<Output22>>; }

export type Input23 = {  };
export type Output23 = ({  } & { [key: string]: JsonValue });
export function call23(client: AppsClient, ref: AppRef, input: Input23, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output23>> { return client.invoke(ref, catalog[23], input as JsonValue, options) as Promise<CapabilityResult<Output23>>; }

export type Input24 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output24 = JsonValue | JsonValue;
export function call24(client: AppsClient, ref: AppRef, input: Input24, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output24>> { return client.invoke(ref, catalog[24], input as JsonValue, options) as Promise<CapabilityResult<Output24>>; }

export type Input25 = {  };
export type Output25 = ({ "appId": "hallmark"; "instructions": string; "tools": Array<{ "name": string; "kind": string }>; "boundaries": ({  } & { [key: string]: JsonValue }) } & { [key: string]: JsonValue });
export function call25(client: AppsClient, ref: AppRef, input: Input25, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output25>> { return client.invoke(ref, catalog[25], input as JsonValue, options) as Promise<CapabilityResult<Output25>>; }

export type Input26 = { "storeId"?: string; "store"?: string; "mode": "search" | "show" | "template" | "values" | "validate_value" | "sync"; "q"?: string; "descriptionCategoryId"?: string; "typeId"?: string; "attributeId"?: string; "valueId"?: string; "dictionaryId"?: string; "aspects"?: Array<string>; "requireAspects"?: boolean; "limit"?: number };
export type Output26 = JsonValue | JsonValue;
export function call26(client: AppsClient, ref: AppRef, input: Input26, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output26>> { return client.invoke(ref, catalog[26], input as JsonValue, options) as Promise<CapabilityResult<Output26>>; }

export type Input27 = { "itemId": string };
export type Output27 = JsonValue | JsonValue;
export function call27(client: AppsClient, ref: AppRef, input: Input27, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output27>> { return client.invoke(ref, catalog[27], input as JsonValue, options) as Promise<CapabilityResult<Output27>>; }

export type Input28 = { "cursor"?: string; "limit"?: number; "query"?: string };
export type Output28 = ({ "datasetKey": string; "items": Array<({  } & { [key: string]: JsonValue })>; "total": number; "cursor"?: string } & { [key: string]: JsonValue }) | ({ "datasetKey": string; "spill": ({ "path": string; "bytes": number; "summary": ({  } & { [key: string]: JsonValue }); "cursor": string } & { [key: string]: JsonValue }); "total": number; "cursor": string; "limit": number } & { [key: string]: JsonValue });
export function call28(client: AppsClient, ref: AppRef, input: Input28, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output28>> { return client.invoke(ref, catalog[28], input as JsonValue, options) as Promise<CapabilityResult<Output28>>; }

export type Input29 = { "datasetKey"?: string; "storeId"?: string; "store"?: string };
export type Output29 = ({ "datasetKey": string; "snapshot": ({  } & { [key: string]: JsonValue }); "counts": ({  } & { [key: string]: JsonValue }) } & { [key: string]: JsonValue });
export function call29(client: AppsClient, ref: AppRef, input: Input29, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output29>> { return client.invoke(ref, catalog[29], input as JsonValue, options) as Promise<CapabilityResult<Output29>>; }

export type Input30 = { "datasetKey"?: string; "storeId"?: string; "store"?: string };
export type Output30 = ({ "datasetKey": string; "state": string; "lastSuccessAt": string | null; "lastError": JsonValue } & { [key: string]: JsonValue });
export function call30(client: AppsClient, ref: AppRef, input: Input30, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output30>> { return client.invoke(ref, catalog[30], input as JsonValue, options) as Promise<CapabilityResult<Output30>>; }

export type Input31 = { "operationId": string };
export type Output31 = ({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue });
export function call31(client: AppsClient, ref: AppRef, input: Input31, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output31>> { return client.invoke(ref, catalog[31], input as JsonValue, options) as Promise<CapabilityResult<Output31>>; }

export type Input32 = { "storeId"?: string; "since"?: string; "limit"?: number };
export type Output32 = Array<({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue })>;
export function call32(client: AppsClient, ref: AppRef, input: Input32, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output32>> { return client.invoke(ref, catalog[32], input as JsonValue, options) as Promise<CapabilityResult<Output32>>; }

export type Input33 = { "storeId"?: string; "store"?: string; "path": string; "method"?: "GET" | "POST"; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output33 = JsonValue | JsonValue;
export function call33(client: AppsClient, ref: AppRef, input: Input33, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output33>> { return client.invoke(ref, catalog[33], input as JsonValue, options) as Promise<CapabilityResult<Output33>>; }

export type Input34 = { "storeId"?: string; "store"?: string; "minMargin"?: number; "maxMargin"?: number; "minPrice"?: number; "maxPrice"?: number; "minStock"?: number; "maxStock"?: number; "status"?: string; "resultSetId"?: string };
export type Output34 = ({ "resultSetId": string; "storeId": string; "expiresAt": string; "payload": JsonValue | JsonValue } & { [key: string]: JsonValue });
export function call34(client: AppsClient, ref: AppRef, input: Input34, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output34>> { return client.invoke(ref, catalog[34], input as JsonValue, options) as Promise<CapabilityResult<Output34>>; }

export type Input35 = { "storeId"?: string; "store"?: string; "cursor"?: string; "limit"?: number; "query"?: string };
export type Output35 = ({ "products": Array<({  } & { [key: string]: JsonValue })>; "total": number } & { [key: string]: JsonValue }) | ({ "spill": ({ "path": string; "bytes": number; "summary": ({  } & { [key: string]: JsonValue }); "cursor": string } & { [key: string]: JsonValue }); "storeId": string; "total": number } & { [key: string]: JsonValue });
export function call35(client: AppsClient, ref: AppRef, input: Input35, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output35>> { return client.invoke(ref, catalog[35], input as JsonValue, options) as Promise<CapabilityResult<Output35>>; }

export type Input36 = { "storeId"?: string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "collectedItemId"?: string; "skuScope"?: Array<string>; "importItems"?: Array<({  } & { [key: string]: JsonValue })> };
export type Output36 = ({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue });
export function call36(client: AppsClient, ref: AppRef, input: Input36, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output36>> { return client.invoke(ref, catalog[36], input as JsonValue, options) as Promise<CapabilityResult<Output36>>; }

export type Input37 = { "storeId"?: string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "price"?: number; "currency"?: string; "oldPrice"?: number; "actionId"?: number };
export type Output37 = ({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue });
export function call37(client: AppsClient, ref: AppRef, input: Input37, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output37>> { return client.invoke(ref, catalog[37], input as JsonValue, options) as Promise<CapabilityResult<Output37>>; }

export type Input38 = { "storeId"?: string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "stock"?: number; "warehouseId"?: string };
export type Output38 = ({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue });
export function call38(client: AppsClient, ref: AppRef, input: Input38, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output38>> { return client.invoke(ref, catalog[38], input as JsonValue, options) as Promise<CapabilityResult<Output38>>; }

export type Input39 = { "storeId"?: string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string> };
export type Output39 = ({ "products": Array<({  } & { [key: string]: JsonValue })>; "total": number } & { [key: string]: JsonValue }) | ({ "spill": ({ "path": string; "bytes": number; "summary": ({  } & { [key: string]: JsonValue }); "cursor": string } & { [key: string]: JsonValue }); "storeId": string; "total": number } & { [key: string]: JsonValue });
export function call39(client: AppsClient, ref: AppRef, input: Input39, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output39>> { return client.invoke(ref, catalog[39], input as JsonValue, options) as Promise<CapabilityResult<Output39>>; }

export type Input40 = {  };
export type Output40 = Array<JsonValue | JsonValue | JsonValue>;
export function call40(client: AppsClient, ref: AppRef, input: Input40, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output40>> { return client.invoke(ref, catalog[40], input as JsonValue, options) as Promise<CapabilityResult<Output40>>; }

export type Input41 = { "query": string };
export type Output41 = JsonValue | JsonValue | JsonValue;
export function call41(client: AppsClient, ref: AppRef, input: Input41, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output41>> { return client.invoke(ref, catalog[41], input as JsonValue, options) as Promise<CapabilityResult<Output41>>; }

export type Input42 = { "id"?: string; "title": string; "content": string };
export type Output42 = { "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } };
export function call42(client: AppsClient, ref: AppRef, input: Input42, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output42>> { return client.invoke(ref, catalog[42], input as JsonValue, options) as Promise<CapabilityResult<Output42>>; }

export type Input43 = { "id": string };
export type Output43 = { "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } };
export function call43(client: AppsClient, ref: AppRef, input: Input43, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output43>> { return client.invoke(ref, catalog[43], input as JsonValue, options) as Promise<CapabilityResult<Output43>>; }

export type Input44 = { "query"?: string; "cursor"?: string; "limit"?: number };
export type Output44 = { "items": Array<{ "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } }>; "total": number; "returned": number; "nextCursor": string | null; "completeness": "complete" | "partial" };
export function call44(client: AppsClient, ref: AppRef, input: Input44, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output44>> { return client.invoke(ref, catalog[44], input as JsonValue, options) as Promise<CapabilityResult<Output44>>; }

export type Input45 = JsonValue | JsonValue;
export type Output45 = { "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } };
export function call45(client: AppsClient, ref: AppRef, input: Input45, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output45>> { return client.invoke(ref, catalog[45], input as JsonValue, options) as Promise<CapabilityResult<Output45>>; }
