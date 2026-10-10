// Generated. Do not edit.
import { AppsClient } from './index.ts';
import type { AppRef, CapabilityResult, JsonValue } from '../../app-contracts/src/index.ts';
export const catalog = [
  {
    "capabilityId": "apps.authoring.begin",
    "version": "1.0.0",
    "title": "begin",
    "description": "Versioned local authoring metadata. Candidates, mounting, confirmed display and explicit saved assets are distinct; this action owns no domain mutation or another Agent loop.",
    "effect": "compute",
    "inputSchema": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "mode": {
              "const": "new"
            },
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "componentId": {
              "type": "string",
              "minLength": 1
            },
            "revision": {
              "type": "integer",
              "minimum": 1
            },
            "workspacePath": {
              "type": "string",
              "minLength": 1
            },
            "newCopy": {
              "type": "boolean"
            },
            "title": {
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
            "sourceRefs": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "revision",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "context": {
              "type": "object",
              "properties": {
                "storeId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "storeId"
              ],
              "additionalProperties": false
            },
            "invocationId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "mode"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "mode": {
              "const": "edit"
            },
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "componentId": {
              "type": "string",
              "minLength": 1
            },
            "revision": {
              "type": "integer",
              "minimum": 1
            },
            "workspacePath": {
              "type": "string",
              "minLength": 1
            },
            "newCopy": {
              "type": "boolean"
            },
            "title": {
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
            "sourceRefs": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "revision",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "context": {
              "type": "object",
              "properties": {
                "storeId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "storeId"
              ],
              "additionalProperties": false
            },
            "invocationId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "mode",
            "viewId"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "mode": {
              "const": "open_saved"
            },
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "componentId": {
              "type": "string",
              "minLength": 1
            },
            "revision": {
              "type": "integer",
              "minimum": 1
            },
            "workspacePath": {
              "type": "string",
              "minLength": 1
            },
            "newCopy": {
              "type": "boolean"
            },
            "title": {
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
            "sourceRefs": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "revision",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "context": {
              "type": "object",
              "properties": {
                "storeId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "storeId"
              ],
              "additionalProperties": false
            },
            "invocationId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "mode",
            "componentId"
          ],
          "additionalProperties": false
        }
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "draft": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "const": 1
            },
            "draftId": {
              "type": "string",
              "minLength": 1
            },
            "ownerSessionId": {
              "type": "string",
              "minLength": 1
            },
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "workspacePath": {
              "type": "string",
              "minLength": 1
            },
            "sourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "epoch": {
              "type": "integer",
              "minimum": 1
            },
            "status": {
              "enum": [
                "editing",
                "building",
                "build_failed",
                "previewing",
                "preview_failed",
                "publish_ready",
                "mounting",
                "mounted",
                "failed_mount",
                "cancelled",
                "superseded",
                "interrupted",
                "closed",
                "discarded"
              ]
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "sourceComponentId": {
              "type": "string",
              "minLength": 1
            },
            "selectedSourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "baseRevisionAtOpen": {
              "type": "integer",
              "minimum": 1
            }
          },
          "required": [
            "schemaVersion",
            "draftId",
            "ownerSessionId",
            "viewId",
            "workspacePath",
            "sourceRevision",
            "epoch",
            "status",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        "attempt": {
          "type": "object",
          "properties": {
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "draftId": {
              "type": "string",
              "minLength": 1
            },
            "epoch": {
              "type": "integer",
              "minimum": 1
            },
            "sourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "state": {
              "enum": [
                "editing",
                "building",
                "build_failed",
                "previewing",
                "preview_failed",
                "publish_ready",
                "mounting",
                "mounted",
                "failed_mount",
                "cancelled",
                "superseded",
                "interrupted"
              ]
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "expectedViewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "invocationRefs": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "evidenceRefs": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "path": {
                    "type": "string",
                    "minLength": 1
                  },
                  "sha256": {
                    "type": "string",
                    "pattern": "^[a-f0-9]{64}$"
                  },
                  "bytes": {
                    "type": "integer",
                    "minimum": 0
                  }
                },
                "required": [
                  "path",
                  "sha256",
                  "bytes"
                ],
                "additionalProperties": false
              }
            },
            "terminalReason": {
              "type": [
                "string",
                "null"
              ]
            },
            "buildReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "previewReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "publicationId": {
              "type": "string",
              "minLength": 1
            },
            "requestHash": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            }
          },
          "required": [
            "attemptId",
            "draftId",
            "epoch",
            "sourceRevision",
            "state",
            "startedAt",
            "expectedViewRevision",
            "invocationRefs",
            "evidenceRefs",
            "terminalReason"
          ],
          "additionalProperties": false
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
            "sourceRefs": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "revision",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "context": {
              "type": "object",
              "properties": {
                "storeId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "storeId"
              ],
              "additionalProperties": false
            },
            "source": {
              "type": "object",
              "properties": {
                "buildId": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
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
                }
              },
              "required": [
                "buildId",
                "directory",
                "entry",
                "files"
              ],
              "additionalProperties": true
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "sourceComponentId": {
              "type": "string",
              "minLength": 1
            },
            "baseRevision": {
              "type": "integer",
              "minimum": 1
            },
            "viewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "activeBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "lastGoodBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "previousGoodBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "pendingPublicationId": {
              "type": [
                "string",
                "null"
              ]
            },
            "validationStatus": {
              "enum": [
                "draft_unpublished",
                "legacy_unverified",
                "verified"
              ]
            }
          },
          "required": [
            "viewId",
            "ownerSessionId",
            "title",
            "design",
            "bindings",
            "createdAt",
            "updatedAt",
            "viewRevision",
            "activeBuildId",
            "lastGoodBuildId",
            "previousGoodBuildId",
            "pendingPublicationId",
            "validationStatus"
          ],
          "additionalProperties": true
        }
      },
      "required": [
        "draft",
        "attempt",
        "view"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "authoring",
        "component",
        "source",
        "receipt"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "apps.authoring.cancel",
    "version": "1.0.0",
    "title": "cancel",
    "description": "Versioned local authoring metadata. Candidates, mounting, confirmed display and explicit saved assets are distinct; this action owns no domain mutation or another Agent loop.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "attemptId": {
          "type": "string",
          "minLength": 1
        },
        "expectedEpoch": {
          "type": "integer",
          "minimum": 1
        },
        "reason": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "attemptId",
        "expectedEpoch",
        "reason"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "cancelled",
            "already_published"
          ]
        },
        "activeBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "viewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "publication": {
          "type": "object",
          "properties": {
            "publicationId": {
              "type": "string",
              "minLength": 1
            },
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "ownerSessionId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "attemptEpoch": {
              "type": "integer",
              "minimum": 1
            },
            "expectedViewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "candidateBuildId": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "priorActiveBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "state": {
              "enum": [
                "prepared",
                "mounting",
                "mounted",
                "failed_mount",
                "cancelled",
                "superseded",
                "interrupted"
              ]
            },
            "readyDeadlineAt": {
              "type": [
                "string",
                "null"
              ],
              "format": "date-time"
            },
            "mountStartedAt": {
              "type": [
                "string",
                "null"
              ],
              "format": "date-time"
            },
            "evidenceRefs": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "path": {
                    "type": "string",
                    "minLength": 1
                  },
                  "sha256": {
                    "type": "string",
                    "pattern": "^[a-f0-9]{64}$"
                  },
                  "bytes": {
                    "type": "integer",
                    "minimum": 0
                  }
                },
                "required": [
                  "path",
                  "sha256",
                  "bytes"
                ],
                "additionalProperties": false
              }
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "buildReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "previewReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "source": {
              "type": "object",
              "properties": {
                "buildId": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
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
                }
              },
              "required": [
                "buildId",
                "directory",
                "entry",
                "files"
              ],
              "additionalProperties": true
            },
            "frameInstanceId": {
              "type": "string",
              "minLength": 1
            },
            "documentNonce": {
              "type": "string",
              "minLength": 1
            },
            "committedViewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "terminalReason": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "publicationId",
            "viewId",
            "ownerSessionId",
            "attemptId",
            "attemptEpoch",
            "expectedViewRevision",
            "candidateBuildId",
            "priorActiveBuildId",
            "state",
            "readyDeadlineAt",
            "evidenceRefs",
            "createdAt",
            "updatedAt",
            "buildReceiptId",
            "previewReceiptId",
            "source"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "status",
        "activeBuildId",
        "viewRevision"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "authoring",
        "component",
        "source",
        "receipt"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "apps.authoring.inspect",
    "version": "1.0.0",
    "title": "inspect",
    "description": "Versioned local authoring metadata. Candidates, mounting, confirmed display and explicit saved assets are distinct; this action owns no domain mutation or another Agent loop.",
    "effect": "query",
    "inputSchema": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "displayId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "attemptId"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "publicationId": {
              "type": "string",
              "minLength": 1
            },
            "displayId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "publicationId"
          ],
          "additionalProperties": false
        }
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "object",
          "properties": {
            "lastConfirmedDisplay": {
              "type": [
                "object",
                "null"
              ]
            },
            "preparedBuild": {
              "type": [
                "object",
                "null"
              ]
            },
            "currentDisplay": {
              "type": [
                "object",
                "null"
              ]
            },
            "blockedStage": {
              "type": "string",
              "minLength": 1
            },
            "nextAction": {
              "type": "object",
              "properties": {
                "action": {
                  "type": "string",
                  "minLength": 1
                },
                "reason": {
                  "type": "string",
                  "minLength": 1
                },
                "target": {
                  "type": "object"
                },
                "errorCodes": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  }
                }
              },
              "required": [
                "action",
                "reason",
                "target",
                "errorCodes"
              ],
              "additionalProperties": false
            },
            "requiresRebuild": {
              "type": [
                "boolean",
                "null"
              ]
            }
          },
          "required": [
            "lastConfirmedDisplay",
            "preparedBuild",
            "currentDisplay",
            "blockedStage",
            "nextAction",
            "requiresRebuild"
          ],
          "additionalProperties": false
        },
        "draft": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "const": 1
            },
            "draftId": {
              "type": "string",
              "minLength": 1
            },
            "ownerSessionId": {
              "type": "string",
              "minLength": 1
            },
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "workspacePath": {
              "type": "string",
              "minLength": 1
            },
            "sourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "epoch": {
              "type": "integer",
              "minimum": 1
            },
            "status": {
              "enum": [
                "editing",
                "building",
                "build_failed",
                "previewing",
                "preview_failed",
                "publish_ready",
                "mounting",
                "mounted",
                "failed_mount",
                "cancelled",
                "superseded",
                "interrupted",
                "closed",
                "discarded"
              ]
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "sourceComponentId": {
              "type": "string",
              "minLength": 1
            },
            "selectedSourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "baseRevisionAtOpen": {
              "type": "integer",
              "minimum": 1
            }
          },
          "required": [
            "schemaVersion",
            "draftId",
            "ownerSessionId",
            "viewId",
            "workspacePath",
            "sourceRevision",
            "epoch",
            "status",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        "attempt": {
          "type": "object",
          "properties": {
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "draftId": {
              "type": "string",
              "minLength": 1
            },
            "epoch": {
              "type": "integer",
              "minimum": 1
            },
            "sourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "state": {
              "enum": [
                "editing",
                "building",
                "build_failed",
                "previewing",
                "preview_failed",
                "publish_ready",
                "mounting",
                "mounted",
                "failed_mount",
                "cancelled",
                "superseded",
                "interrupted"
              ]
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "expectedViewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "invocationRefs": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "evidenceRefs": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "path": {
                    "type": "string",
                    "minLength": 1
                  },
                  "sha256": {
                    "type": "string",
                    "pattern": "^[a-f0-9]{64}$"
                  },
                  "bytes": {
                    "type": "integer",
                    "minimum": 0
                  }
                },
                "required": [
                  "path",
                  "sha256",
                  "bytes"
                ],
                "additionalProperties": false
              }
            },
            "terminalReason": {
              "type": [
                "string",
                "null"
              ]
            },
            "buildReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "previewReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "publicationId": {
              "type": "string",
              "minLength": 1
            },
            "requestHash": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            }
          },
          "required": [
            "attemptId",
            "draftId",
            "epoch",
            "sourceRevision",
            "state",
            "startedAt",
            "expectedViewRevision",
            "invocationRefs",
            "evidenceRefs",
            "terminalReason"
          ],
          "additionalProperties": false
        },
        "publication": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "publicationId": {
                  "type": "string",
                  "minLength": 1
                },
                "viewId": {
                  "type": "string",
                  "minLength": 1
                },
                "ownerSessionId": {
                  "type": "string",
                  "minLength": 1
                },
                "attemptId": {
                  "type": "string",
                  "minLength": 1
                },
                "attemptEpoch": {
                  "type": "integer",
                  "minimum": 1
                },
                "expectedViewRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "candidateBuildId": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "priorActiveBuildId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "state": {
                  "enum": [
                    "prepared",
                    "mounting",
                    "mounted",
                    "failed_mount",
                    "cancelled",
                    "superseded",
                    "interrupted"
                  ]
                },
                "readyDeadlineAt": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "format": "date-time"
                },
                "mountStartedAt": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "format": "date-time"
                },
                "evidenceRefs": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "path": {
                        "type": "string",
                        "minLength": 1
                      },
                      "sha256": {
                        "type": "string",
                        "pattern": "^[a-f0-9]{64}$"
                      },
                      "bytes": {
                        "type": "integer",
                        "minimum": 0
                      }
                    },
                    "required": [
                      "path",
                      "sha256",
                      "bytes"
                    ],
                    "additionalProperties": false
                  }
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "buildReceiptId": {
                  "type": "string",
                  "minLength": 1
                },
                "previewReceiptId": {
                  "type": "string",
                  "minLength": 1
                },
                "source": {
                  "type": "object",
                  "properties": {
                    "buildId": {
                      "type": "string",
                      "pattern": "^[a-f0-9]{64}$"
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
                    }
                  },
                  "required": [
                    "buildId",
                    "directory",
                    "entry",
                    "files"
                  ],
                  "additionalProperties": true
                },
                "frameInstanceId": {
                  "type": "string",
                  "minLength": 1
                },
                "documentNonce": {
                  "type": "string",
                  "minLength": 1
                },
                "committedViewRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "terminalReason": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "publicationId",
                "viewId",
                "ownerSessionId",
                "attemptId",
                "attemptEpoch",
                "expectedViewRevision",
                "candidateBuildId",
                "priorActiveBuildId",
                "state",
                "readyDeadlineAt",
                "evidenceRefs",
                "createdAt",
                "updatedAt",
                "buildReceiptId",
                "previewReceiptId",
                "source"
              ],
              "additionalProperties": false
            },
            {
              "type": "null"
            }
          ]
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
            "sourceRefs": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "revision",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "context": {
              "type": "object",
              "properties": {
                "storeId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "storeId"
              ],
              "additionalProperties": false
            },
            "source": {
              "type": "object",
              "properties": {
                "buildId": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
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
                }
              },
              "required": [
                "buildId",
                "directory",
                "entry",
                "files"
              ],
              "additionalProperties": true
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "sourceComponentId": {
              "type": "string",
              "minLength": 1
            },
            "baseRevision": {
              "type": "integer",
              "minimum": 1
            },
            "viewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "activeBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "lastGoodBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "previousGoodBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "pendingPublicationId": {
              "type": [
                "string",
                "null"
              ]
            },
            "validationStatus": {
              "enum": [
                "draft_unpublished",
                "legacy_unverified",
                "verified"
              ]
            }
          },
          "required": [
            "viewId",
            "ownerSessionId",
            "title",
            "design",
            "bindings",
            "createdAt",
            "updatedAt",
            "viewRevision",
            "activeBuildId",
            "lastGoodBuildId",
            "previousGoodBuildId",
            "pendingPublicationId",
            "validationStatus"
          ],
          "additionalProperties": true
        },
        "latestDisplay": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "displayId": {
                  "type": "string",
                  "minLength": 1
                },
                "generation": {
                  "type": "integer",
                  "minimum": 1
                },
                "ownerSessionId": {
                  "type": "string",
                  "minLength": 1
                },
                "viewId": {
                  "type": "string",
                  "minLength": 1
                },
                "publicationId": {
                  "type": "string",
                  "minLength": 1
                },
                "attemptId": {
                  "type": "string",
                  "minLength": 1
                },
                "attemptEpoch": {
                  "type": "integer",
                  "minimum": 1
                },
                "buildId": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "expectedViewRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "state": {
                  "enum": [
                    "opening",
                    "ready",
                    "failed",
                    "retired"
                  ]
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
                    "sourceRefs": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string",
                            "minLength": 1
                          },
                          "revision": {
                            "type": "integer",
                            "minimum": 1
                          },
                          "params": {
                            "type": "object"
                          }
                        },
                        "required": [
                          "id",
                          "revision",
                          "params"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "context": {
                      "type": "object",
                      "properties": {
                        "storeId": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "required": [
                        "storeId"
                      ],
                      "additionalProperties": false
                    },
                    "source": {
                      "type": "object",
                      "properties": {
                        "buildId": {
                          "type": "string",
                          "pattern": "^[a-f0-9]{64}$"
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
                        }
                      },
                      "required": [
                        "buildId",
                        "directory",
                        "entry",
                        "files"
                      ],
                      "additionalProperties": true
                    },
                    "createdAt": {
                      "type": "string",
                      "format": "date-time"
                    },
                    "updatedAt": {
                      "type": "string",
                      "format": "date-time"
                    },
                    "sourceComponentId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "baseRevision": {
                      "type": "integer",
                      "minimum": 1
                    },
                    "viewRevision": {
                      "type": "integer",
                      "minimum": 1
                    },
                    "activeBuildId": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "lastGoodBuildId": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "previousGoodBuildId": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "pendingPublicationId": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "validationStatus": {
                      "enum": [
                        "draft_unpublished",
                        "legacy_unverified",
                        "verified"
                      ]
                    }
                  },
                  "required": [
                    "viewId",
                    "ownerSessionId",
                    "title",
                    "design",
                    "bindings",
                    "createdAt",
                    "updatedAt",
                    "viewRevision",
                    "activeBuildId",
                    "lastGoodBuildId",
                    "previousGoodBuildId",
                    "pendingPublicationId",
                    "validationStatus"
                  ],
                  "additionalProperties": true
                },
                "errors": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "phase": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 80
                      },
                      "code": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 160
                      },
                      "message": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 4096
                      },
                      "at": {
                        "type": "string",
                        "format": "date-time"
                      }
                    },
                    "required": [
                      "phase",
                      "code",
                      "message"
                    ],
                    "additionalProperties": false
                  }
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "readyAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "frameInstanceId": {
                  "type": "string",
                  "minLength": 1
                },
                "documentNonce": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "displayId",
                "generation",
                "ownerSessionId",
                "viewId",
                "publicationId",
                "attemptId",
                "attemptEpoch",
                "buildId",
                "expectedViewRevision",
                "state",
                "view",
                "errors",
                "createdAt",
                "updatedAt"
              ],
              "additionalProperties": false
            },
            {
              "type": "null"
            }
          ]
        },
        "displays": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "displayId": {
                "type": "string",
                "minLength": 1
              },
              "generation": {
                "type": "integer",
                "minimum": 1
              },
              "ownerSessionId": {
                "type": "string",
                "minLength": 1
              },
              "viewId": {
                "type": "string",
                "minLength": 1
              },
              "publicationId": {
                "type": "string",
                "minLength": 1
              },
              "attemptId": {
                "type": "string",
                "minLength": 1
              },
              "attemptEpoch": {
                "type": "integer",
                "minimum": 1
              },
              "buildId": {
                "type": "string",
                "pattern": "^[a-f0-9]{64}$"
              },
              "expectedViewRevision": {
                "type": "integer",
                "minimum": 1
              },
              "state": {
                "enum": [
                  "opening",
                  "ready",
                  "failed",
                  "retired"
                ]
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
                  "sourceRefs": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "minLength": 1
                        },
                        "revision": {
                          "type": "integer",
                          "minimum": 1
                        },
                        "params": {
                          "type": "object"
                        }
                      },
                      "required": [
                        "id",
                        "revision",
                        "params"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "context": {
                    "type": "object",
                    "properties": {
                      "storeId": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "storeId"
                    ],
                    "additionalProperties": false
                  },
                  "source": {
                    "type": "object",
                    "properties": {
                      "buildId": {
                        "type": "string",
                        "pattern": "^[a-f0-9]{64}$"
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
                      }
                    },
                    "required": [
                      "buildId",
                      "directory",
                      "entry",
                      "files"
                    ],
                    "additionalProperties": true
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "updatedAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "sourceComponentId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "baseRevision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "viewRevision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "activeBuildId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "lastGoodBuildId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "previousGoodBuildId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "pendingPublicationId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "validationStatus": {
                    "enum": [
                      "draft_unpublished",
                      "legacy_unverified",
                      "verified"
                    ]
                  }
                },
                "required": [
                  "viewId",
                  "ownerSessionId",
                  "title",
                  "design",
                  "bindings",
                  "createdAt",
                  "updatedAt",
                  "viewRevision",
                  "activeBuildId",
                  "lastGoodBuildId",
                  "previousGoodBuildId",
                  "pendingPublicationId",
                  "validationStatus"
                ],
                "additionalProperties": true
              },
              "errors": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "phase": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 80
                    },
                    "code": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 160
                    },
                    "message": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 4096
                    },
                    "at": {
                      "type": "string",
                      "format": "date-time"
                    }
                  },
                  "required": [
                    "phase",
                    "code",
                    "message"
                  ],
                  "additionalProperties": false
                }
              },
              "createdAt": {
                "type": "string",
                "format": "date-time"
              },
              "updatedAt": {
                "type": "string",
                "format": "date-time"
              },
              "readyAt": {
                "type": "string",
                "format": "date-time"
              },
              "frameInstanceId": {
                "type": "string",
                "minLength": 1
              },
              "documentNonce": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "displayId",
              "generation",
              "ownerSessionId",
              "viewId",
              "publicationId",
              "attemptId",
              "attemptEpoch",
              "buildId",
              "expectedViewRevision",
              "state",
              "view",
              "errors",
              "createdAt",
              "updatedAt"
            ],
            "additionalProperties": false
          }
        },
        "display": {
          "type": "object",
          "properties": {
            "displayId": {
              "type": "string",
              "minLength": 1
            },
            "generation": {
              "type": "integer",
              "minimum": 1
            },
            "ownerSessionId": {
              "type": "string",
              "minLength": 1
            },
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "publicationId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "attemptEpoch": {
              "type": "integer",
              "minimum": 1
            },
            "buildId": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "expectedViewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "state": {
              "enum": [
                "opening",
                "ready",
                "failed",
                "retired"
              ]
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
                "sourceRefs": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "minLength": 1
                      },
                      "revision": {
                        "type": "integer",
                        "minimum": 1
                      },
                      "params": {
                        "type": "object"
                      }
                    },
                    "required": [
                      "id",
                      "revision",
                      "params"
                    ],
                    "additionalProperties": false
                  }
                },
                "context": {
                  "type": "object",
                  "properties": {
                    "storeId": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "storeId"
                  ],
                  "additionalProperties": false
                },
                "source": {
                  "type": "object",
                  "properties": {
                    "buildId": {
                      "type": "string",
                      "pattern": "^[a-f0-9]{64}$"
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
                    }
                  },
                  "required": [
                    "buildId",
                    "directory",
                    "entry",
                    "files"
                  ],
                  "additionalProperties": true
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "sourceComponentId": {
                  "type": "string",
                  "minLength": 1
                },
                "baseRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "viewRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "activeBuildId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "lastGoodBuildId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "previousGoodBuildId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "pendingPublicationId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "validationStatus": {
                  "enum": [
                    "draft_unpublished",
                    "legacy_unverified",
                    "verified"
                  ]
                }
              },
              "required": [
                "viewId",
                "ownerSessionId",
                "title",
                "design",
                "bindings",
                "createdAt",
                "updatedAt",
                "viewRevision",
                "activeBuildId",
                "lastGoodBuildId",
                "previousGoodBuildId",
                "pendingPublicationId",
                "validationStatus"
              ],
              "additionalProperties": true
            },
            "errors": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "phase": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  "code": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 160
                  },
                  "message": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 4096
                  },
                  "at": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "required": [
                  "phase",
                  "code",
                  "message"
                ],
                "additionalProperties": false
              }
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            },
            "readyAt": {
              "type": "string",
              "format": "date-time"
            },
            "frameInstanceId": {
              "type": "string",
              "minLength": 1
            },
            "documentNonce": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "displayId",
            "generation",
            "ownerSessionId",
            "viewId",
            "publicationId",
            "attemptId",
            "attemptEpoch",
            "buildId",
            "expectedViewRevision",
            "state",
            "view",
            "errors",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        "workspaceAvailable": {
          "type": "boolean"
        },
        "missingEvidence": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      },
      "required": [
        "summary",
        "draft",
        "attempt",
        "publication",
        "view",
        "latestDisplay",
        "displays",
        "workspaceAvailable",
        "missingEvidence"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "authoring",
        "component",
        "source",
        "receipt"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "apps.authoring.publish",
    "version": "1.0.0",
    "title": "publish",
    "description": "Versioned local authoring metadata. Candidates, mounting, confirmed display and explicit saved assets are distinct; this action owns no domain mutation or another Agent loop.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "attemptId": {
          "type": "string",
          "minLength": 1
        },
        "epoch": {
          "type": "integer",
          "minimum": 1
        },
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "expectedViewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "buildId": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "buildReceiptId": {
          "type": "string",
          "minLength": 1
        },
        "previewReceiptId": {
          "type": "string",
          "minLength": 1
        },
        "publicationId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "attemptId",
        "epoch",
        "viewId",
        "expectedViewRevision",
        "buildId",
        "buildReceiptId",
        "previewReceiptId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "publicationId": {
          "type": "string",
          "minLength": 1
        },
        "viewId": {
          "type": "string",
          "minLength": 1
        },
        "ownerSessionId": {
          "type": "string",
          "minLength": 1
        },
        "attemptId": {
          "type": "string",
          "minLength": 1
        },
        "attemptEpoch": {
          "type": "integer",
          "minimum": 1
        },
        "expectedViewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "candidateBuildId": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "priorActiveBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "state": {
          "enum": [
            "prepared",
            "mounting",
            "mounted",
            "failed_mount",
            "cancelled",
            "superseded",
            "interrupted"
          ]
        },
        "readyDeadlineAt": {
          "type": [
            "string",
            "null"
          ],
          "format": "date-time"
        },
        "mountStartedAt": {
          "type": [
            "string",
            "null"
          ],
          "format": "date-time"
        },
        "evidenceRefs": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string",
                "minLength": 1
              },
              "sha256": {
                "type": "string",
                "pattern": "^[a-f0-9]{64}$"
              },
              "bytes": {
                "type": "integer",
                "minimum": 0
              }
            },
            "required": [
              "path",
              "sha256",
              "bytes"
            ],
            "additionalProperties": false
          }
        },
        "createdAt": {
          "type": "string",
          "format": "date-time"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time"
        },
        "buildReceiptId": {
          "type": "string",
          "minLength": 1
        },
        "previewReceiptId": {
          "type": "string",
          "minLength": 1
        },
        "source": {
          "type": "object",
          "properties": {
            "buildId": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
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
            }
          },
          "required": [
            "buildId",
            "directory",
            "entry",
            "files"
          ],
          "additionalProperties": true
        },
        "frameInstanceId": {
          "type": "string",
          "minLength": 1
        },
        "documentNonce": {
          "type": "string",
          "minLength": 1
        },
        "committedViewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "terminalReason": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "publicationId",
        "viewId",
        "ownerSessionId",
        "attemptId",
        "attemptEpoch",
        "expectedViewRevision",
        "candidateBuildId",
        "priorActiveBuildId",
        "state",
        "readyDeadlineAt",
        "evidenceRefs",
        "createdAt",
        "updatedAt",
        "buildReceiptId",
        "previewReceiptId",
        "source"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "authoring",
        "component",
        "source",
        "receipt"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "apps.authoring.record_build",
    "version": "1.0.0",
    "title": "record_build",
    "description": "Versioned local authoring metadata. Candidates, mounting, confirmed display and explicit saved assets are distinct; this action owns no domain mutation or another Agent loop.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "attemptId": {
          "type": "string",
          "minLength": 1
        },
        "epoch": {
          "type": "integer",
          "minimum": 1
        },
        "reportRef": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "sha256": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "path",
            "sha256",
            "bytes"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "attemptId",
        "epoch",
        "reportRef"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "const": 1
            },
            "receiptId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "sourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "sourceInputDigest": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "lockfileDigest": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "command": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "cwd": {
              "type": "string",
              "minLength": 1
            },
            "toolchain": {
              "type": "object",
              "minProperties": 1,
              "additionalProperties": {
                "type": "string"
              }
            },
            "exitCode": {
              "const": 0
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "finishedAt": {
              "type": "string",
              "format": "date-time"
            },
            "logRef": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "sha256": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                }
              },
              "required": [
                "path",
                "sha256",
                "bytes"
              ],
              "additionalProperties": false
            },
            "distDigest": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "archiveBuildId": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "fileManifestRef": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "sha256": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                }
              },
              "required": [
                "path",
                "sha256",
                "bytes"
              ],
              "additionalProperties": false
            },
            "inputUnchanged": {
              "const": true
            },
            "verdict": {
              "const": "PASS"
            },
            "executionKind": {
              "enum": [
                "executed",
                "reuse"
              ]
            },
            "executionId": {
              "type": "string",
              "minLength": 1
            },
            "reusedFrom": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "sha256": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                }
              },
              "required": [
                "path",
                "sha256",
                "bytes"
              ],
              "additionalProperties": false
            },
            "reuseVerifiedAt": {
              "type": "string",
              "format": "date-time"
            }
          },
          "required": [
            "schemaVersion",
            "receiptId",
            "attemptId",
            "sourceRevision",
            "sourceInputDigest",
            "lockfileDigest",
            "command",
            "cwd",
            "toolchain",
            "exitCode",
            "startedAt",
            "finishedAt",
            "logRef",
            "distDigest",
            "archiveBuildId",
            "fileManifestRef",
            "inputUnchanged",
            "verdict"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "const": 1
            },
            "receiptId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "sourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "sourceInputDigest": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "lockfileDigest": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "command": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "cwd": {
              "type": "string",
              "minLength": 1
            },
            "toolchain": {
              "type": "object",
              "minProperties": 1,
              "additionalProperties": {
                "type": "string"
              }
            },
            "exitCode": {
              "type": "integer"
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "finishedAt": {
              "type": "string",
              "format": "date-time"
            },
            "logRef": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "sha256": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                }
              },
              "required": [
                "path",
                "sha256",
                "bytes"
              ],
              "additionalProperties": false
            },
            "distDigest": {
              "anyOf": [
                {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                {
                  "type": "null"
                }
              ]
            },
            "archiveBuildId": {
              "anyOf": [
                {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                {
                  "type": "null"
                }
              ]
            },
            "fileManifestRef": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "path": {
                      "type": "string",
                      "minLength": 1
                    },
                    "sha256": {
                      "type": "string",
                      "pattern": "^[a-f0-9]{64}$"
                    },
                    "bytes": {
                      "type": "integer",
                      "minimum": 0
                    }
                  },
                  "required": [
                    "path",
                    "sha256",
                    "bytes"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "inputUnchanged": {
              "type": "boolean"
            },
            "verdict": {
              "const": "FAIL"
            },
            "executionKind": {
              "enum": [
                "executed",
                "reuse"
              ]
            },
            "executionId": {
              "type": "string",
              "minLength": 1
            },
            "reusedFrom": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "minLength": 1
                },
                "sha256": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "bytes": {
                  "type": "integer",
                  "minimum": 0
                }
              },
              "required": [
                "path",
                "sha256",
                "bytes"
              ],
              "additionalProperties": false
            },
            "reuseVerifiedAt": {
              "type": "string",
              "format": "date-time"
            }
          },
          "required": [
            "schemaVersion",
            "receiptId",
            "attemptId",
            "sourceRevision",
            "sourceInputDigest",
            "lockfileDigest",
            "command",
            "cwd",
            "toolchain",
            "exitCode",
            "startedAt",
            "finishedAt",
            "logRef",
            "distDigest",
            "archiveBuildId",
            "fileManifestRef",
            "inputUnchanged",
            "verdict"
          ],
          "additionalProperties": false
        }
      ]
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "authoring",
        "component",
        "source",
        "receipt"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "apps.authoring.record_preview",
    "version": "1.0.0",
    "title": "record_preview",
    "description": "Versioned local authoring metadata. Candidates, mounting, confirmed display and explicit saved assets are distinct; this action owns no domain mutation or another Agent loop.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "attemptId": {
          "type": "string",
          "minLength": 1
        },
        "epoch": {
          "type": "integer",
          "minimum": 1
        },
        "buildReceiptId": {
          "type": "string",
          "minLength": 1
        },
        "reportRef": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "sha256": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            }
          },
          "required": [
            "path",
            "sha256",
            "bytes"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "attemptId",
        "epoch",
        "buildReceiptId",
        "reportRef"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "const": 1
            },
            "receiptId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "buildReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "buildId": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "protocol": {
              "const": "dsh.apps.component.v2"
            },
            "mode": {
              "enum": [
                "fixture",
                "live_readonly"
              ]
            },
            "runnerVersion": {
              "type": "string",
              "minLength": 1
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "finishedAt": {
              "type": "string",
              "format": "date-time"
            },
            "viewportResults": {
              "type": "array",
              "minItems": 2,
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "contentWidthCssPx": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "heightCssPx": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "deviceScaleFactor": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "screenshot": {
                    "type": "object",
                    "properties": {
                      "path": {
                        "type": "string",
                        "minLength": 1
                      },
                      "sha256": {
                        "type": "string",
                        "pattern": "^[a-f0-9]{64}$"
                      },
                      "bytes": {
                        "type": "integer",
                        "minimum": 0
                      }
                    },
                    "required": [
                      "path",
                      "sha256",
                      "bytes"
                    ],
                    "additionalProperties": false
                  },
                  "pageErrors": {
                    "type": "array",
                    "maxItems": 0,
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "unhandledRejections": {
                    "type": "array",
                    "maxItems": 0,
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "failedRequests": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "bridgeReady": {
                    "const": true
                  },
                  "assertionIds": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  }
                },
                "required": [
                  "id",
                  "contentWidthCssPx",
                  "heightCssPx",
                  "deviceScaleFactor",
                  "screenshot",
                  "pageErrors",
                  "unhandledRejections",
                  "failedRequests",
                  "bridgeReady",
                  "assertionIds"
                ],
                "additionalProperties": false
              }
            },
            "assertionResults": {
              "type": "array",
              "minItems": 1,
              "items": {
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "minLength": 1
                      },
                      "required": {
                        "const": true
                      },
                      "expected": {
                        "type": "string",
                        "minLength": 1
                      },
                      "actual": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "status": {
                        "const": "PASS"
                      },
                      "evidenceRefs": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "path": {
                              "type": "string",
                              "minLength": 1
                            },
                            "sha256": {
                              "type": "string",
                              "pattern": "^[a-f0-9]{64}$"
                            },
                            "bytes": {
                              "type": "integer",
                              "minimum": 0
                            }
                          },
                          "required": [
                            "path",
                            "sha256",
                            "bytes"
                          ],
                          "additionalProperties": false
                        }
                      }
                    },
                    "required": [
                      "id",
                      "required",
                      "expected",
                      "actual",
                      "status",
                      "evidenceRefs"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "minLength": 1
                      },
                      "required": {
                        "const": false
                      },
                      "expected": {
                        "type": "string",
                        "minLength": 1
                      },
                      "actual": {
                        "type": [
                          "string",
                          "null"
                        ]
                      },
                      "status": {
                        "enum": [
                          "PASS",
                          "FAIL",
                          "NOT_RUN",
                          "BLOCKED"
                        ]
                      },
                      "evidenceRefs": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "path": {
                              "type": "string",
                              "minLength": 1
                            },
                            "sha256": {
                              "type": "string",
                              "pattern": "^[a-f0-9]{64}$"
                            },
                            "bytes": {
                              "type": "integer",
                              "minimum": 0
                            }
                          },
                          "required": [
                            "path",
                            "sha256",
                            "bytes"
                          ],
                          "additionalProperties": false
                        }
                      }
                    },
                    "required": [
                      "id",
                      "required",
                      "expected",
                      "actual",
                      "status",
                      "evidenceRefs"
                    ],
                    "additionalProperties": false
                  }
                ]
              }
            },
            "verdict": {
              "const": "PASS"
            }
          },
          "required": [
            "schemaVersion",
            "receiptId",
            "attemptId",
            "buildReceiptId",
            "buildId",
            "protocol",
            "mode",
            "runnerVersion",
            "startedAt",
            "finishedAt",
            "viewportResults",
            "assertionResults",
            "verdict"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "const": 1
            },
            "receiptId": {
              "type": "string",
              "minLength": 1
            },
            "attemptId": {
              "type": "string",
              "minLength": 1
            },
            "buildReceiptId": {
              "type": "string",
              "minLength": 1
            },
            "buildId": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "protocol": {
              "const": "dsh.apps.component.v2"
            },
            "mode": {
              "enum": [
                "fixture",
                "live_readonly"
              ]
            },
            "runnerVersion": {
              "type": "string",
              "minLength": 1
            },
            "startedAt": {
              "type": "string",
              "format": "date-time"
            },
            "finishedAt": {
              "type": "string",
              "format": "date-time"
            },
            "viewportResults": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "contentWidthCssPx": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "heightCssPx": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "deviceScaleFactor": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "screenshot": {
                    "type": "object",
                    "properties": {
                      "path": {
                        "type": "string",
                        "minLength": 1
                      },
                      "sha256": {
                        "type": "string",
                        "pattern": "^[a-f0-9]{64}$"
                      },
                      "bytes": {
                        "type": "integer",
                        "minimum": 0
                      }
                    },
                    "required": [
                      "path",
                      "sha256",
                      "bytes"
                    ],
                    "additionalProperties": false
                  },
                  "pageErrors": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "unhandledRejections": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "failedRequests": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "bridgeReady": {
                    "type": "boolean"
                  },
                  "assertionIds": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  }
                },
                "required": [
                  "id",
                  "contentWidthCssPx",
                  "heightCssPx",
                  "deviceScaleFactor",
                  "screenshot",
                  "pageErrors",
                  "unhandledRejections",
                  "failedRequests",
                  "bridgeReady",
                  "assertionIds"
                ],
                "additionalProperties": false
              }
            },
            "assertionResults": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "required": {
                    "type": "boolean"
                  },
                  "expected": {
                    "type": "string",
                    "minLength": 1
                  },
                  "actual": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "status": {
                    "enum": [
                      "PASS",
                      "FAIL",
                      "NOT_RUN",
                      "BLOCKED"
                    ]
                  },
                  "evidenceRefs": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "path": {
                          "type": "string",
                          "minLength": 1
                        },
                        "sha256": {
                          "type": "string",
                          "pattern": "^[a-f0-9]{64}$"
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 0
                        }
                      },
                      "required": [
                        "path",
                        "sha256",
                        "bytes"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "id",
                  "required",
                  "expected",
                  "actual",
                  "status",
                  "evidenceRefs"
                ],
                "additionalProperties": false
              }
            },
            "verdict": {
              "enum": [
                "FAIL",
                "INCOMPLETE"
              ]
            }
          },
          "required": [
            "schemaVersion",
            "receiptId",
            "attemptId",
            "buildReceiptId",
            "buildId",
            "protocol",
            "mode",
            "runnerVersion",
            "startedAt",
            "finishedAt",
            "viewportResults",
            "assertionResults",
            "verdict"
          ],
          "additionalProperties": false
        }
      ]
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "authoring",
        "component",
        "source",
        "receipt"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "apps.authoring.save_component",
    "version": "1.0.0",
    "title": "save_component",
    "description": "Explicitly save a confirmed authoring view using component/view CAS and the existing idempotent mutation ledger.",
    "effect": "mutation",
    "inputSchema": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "expectedViewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "userRequest": {
              "type": "string",
              "minLength": 1
            },
            "mode": {
              "const": "save_as"
            },
            "title": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "viewId",
            "expectedViewRevision",
            "userRequest",
            "mode"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "viewId": {
              "type": "string",
              "minLength": 1
            },
            "expectedViewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "userRequest": {
              "type": "string",
              "minLength": 1
            },
            "mode": {
              "const": "update"
            },
            "componentId": {
              "type": "string",
              "minLength": 1
            },
            "expectedRevision": {
              "type": "integer",
              "minimum": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "viewId",
            "expectedViewRevision",
            "userRequest",
            "mode",
            "componentId",
            "expectedRevision"
          ],
          "additionalProperties": false
        }
      ]
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
          "type": "object"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1
        },
        "savedAt": {
          "type": "string",
          "format": "date-time"
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
      "additionalProperties": true
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
        "authoring",
        "component",
        "source",
        "receipt"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "apps.presentation.list_data_sources",
    "version": "1.0.0",
    "title": "listDataSources",
    "description": "Shared component listDataSources. Builds and drafts remain separate from explicit saved assets.",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "appId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "sources": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "title": {
                "type": "string",
                "minLength": 1
              },
              "description": {
                "type": "string"
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
              "storeScoped": {
                "type": "boolean"
              },
              "input": {
                "type": "object"
              },
              "rowsPath": {
                "type": "string"
              },
              "parameters": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string",
                      "minLength": 1
                    },
                    "label": {
                      "type": "string",
                      "minLength": 1
                    },
                    "type": {
                      "enum": [
                        "string",
                        "number",
                        "integer",
                        "boolean"
                      ]
                    },
                    "required": {
                      "type": "boolean"
                    },
                    "default": {},
                    "linked": {
                      "type": "boolean"
                    },
                    "editable": {
                      "type": "boolean"
                    },
                    "choices": {
                      "type": "array",
                      "minItems": 1,
                      "items": {
                        "type": "object",
                        "properties": {
                          "label": {
                            "type": "string",
                            "minLength": 1
                          },
                          "value": {
                            "type": [
                              "string",
                              "number",
                              "boolean"
                            ]
                          }
                        },
                        "required": [
                          "label",
                          "value"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "name",
                    "label",
                    "type"
                  ],
                  "additionalProperties": false
                }
              },
              "fields": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "type": "object",
                  "properties": {
                    "key": {
                      "type": "string",
                      "minLength": 1
                    },
                    "origin": {
                      "type": "object",
                      "properties": {
                        "source": {
                          "type": "string",
                          "minLength": 1
                        },
                        "label": {
                          "type": "string",
                          "minLength": 1
                        }
                      },
                      "required": [
                        "source",
                        "label"
                      ],
                      "additionalProperties": false
                    },
                    "path": {
                      "type": "string",
                      "minLength": 1
                    },
                    "role": {
                      "type": "string",
                      "minLength": 1
                    },
                    "confirmed": {
                      "type": "boolean"
                    },
                    "label": {
                      "type": "string",
                      "minLength": 1
                    },
                    "description": {
                      "type": "string"
                    },
                    "unit": {
                      "type": "string",
                      "minLength": 1
                    },
                    "currency": {
                      "type": "string",
                      "minLength": 1
                    },
                    "currencyPath": {
                      "type": "string",
                      "minLength": 1
                    },
                    "percentScale": {
                      "enum": [
                        "fraction",
                        "whole"
                      ]
                    },
                    "numericScale": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "path",
                    "role",
                    "confirmed"
                  ],
                  "additionalProperties": false
                }
              },
              "operations": {
                "type": "object",
                "properties": {
                  "pagination": {
                    "type": "object",
                    "properties": {
                      "cursorParam": {
                        "type": "string",
                        "minLength": 1
                      },
                      "limitParam": {
                        "type": "string",
                        "minLength": 1
                      },
                      "nextCursorPath": {
                        "type": "string",
                        "minLength": 1
                      },
                      "totalPath": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "cursorParam"
                    ],
                    "additionalProperties": false
                  },
                  "search": {
                    "type": "object",
                    "properties": {
                      "scope": {
                        "enum": [
                          "server",
                          "loaded"
                        ]
                      },
                      "param": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "scope"
                    ],
                    "additionalProperties": false
                  },
                  "sort": {
                    "type": "object",
                    "properties": {
                      "scope": {
                        "enum": [
                          "server",
                          "loaded"
                        ]
                      },
                      "param": {
                        "type": "string",
                        "minLength": 1
                      },
                      "directionParam": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "scope"
                    ],
                    "additionalProperties": false
                  }
                },
                "required": [
                  "search",
                  "sort"
                ],
                "additionalProperties": false
              },
              "kind": {
                "const": "data_source"
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "validation": {
                "type": "object",
                "properties": {
                  "status": {
                    "enum": [
                      "verified",
                      "failed",
                      "unverified"
                    ]
                  },
                  "checkedAt": {
                    "type": "string",
                    "minLength": 1
                  },
                  "invocationId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "sampleCount": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "issues": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "empty": {
                    "type": "boolean"
                  },
                  "storeId": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "status",
                  "checkedAt",
                  "sampleCount",
                  "issues"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "id",
              "title",
              "appId",
              "connectionId",
              "capabilityId",
              "capabilityMajor",
              "input",
              "parameters",
              "fields",
              "rowsPath",
              "operations",
              "kind",
              "revision",
              "validation"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "sources"
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
      "hallmark_list_data_sources"
    ]
  },
  {
    "capabilityId": "apps.presentation.list_materials",
    "version": "1.0.0",
    "title": "listMaterials",
    "description": "Shared component listMaterials. Builds and drafts remain separate from explicit saved assets.",
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
        "materials": {
          "type": "array",
          "items": {
            "type": "object"
          }
        },
        "fieldRoles": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "key": {
                "type": "string",
                "minLength": 1
              },
              "label": {
                "type": "string",
                "minLength": 1
              },
              "description": {
                "type": "string",
                "minLength": 1
              },
              "format": {
                "enum": [
                  "text",
                  "currency",
                  "percent",
                  "integer",
                  "datetime",
                  "image"
                ]
              },
              "unit": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "key",
              "label",
              "description",
              "format"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "materials",
        "fieldRoles"
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
      "hallmark_list_materials"
    ]
  },
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
                  "sourceRefs": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "minLength": 1
                        },
                        "revision": {
                          "type": "integer",
                          "minimum": 1
                        },
                        "params": {
                          "type": "object"
                        }
                      },
                      "required": [
                        "id",
                        "revision",
                        "params"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "context": {
                    "type": "object",
                    "properties": {
                      "storeId": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "storeId"
                    ],
                    "additionalProperties": false
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
                  "panelState": {
                    "enum": [
                      "open",
                      "closed"
                    ]
                  },
                  "closedAt": {
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
                  "baseRevisionAtOpen": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "selectedSourceRevision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "viewRevision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "activeBuildId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "lastGoodBuildId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "previousGoodBuildId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "pendingPublicationId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "validationStatus": {
                    "enum": [
                      "draft_unpublished",
                      "legacy_unverified",
                      "verified",
                      "failed"
                    ]
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
                  "sourceRefs": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "minLength": 1
                        },
                        "revision": {
                          "type": "integer",
                          "minimum": 1
                        },
                        "params": {
                          "type": "object"
                        }
                      },
                      "required": [
                        "id",
                        "revision",
                        "params"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "context": {
                    "type": "object",
                    "properties": {
                      "storeId": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "storeId"
                    ],
                    "additionalProperties": false
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
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 1
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
                "sourceRefs": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "minLength": 1
                      },
                      "revision": {
                        "type": "integer",
                        "minimum": 1
                      },
                      "params": {
                        "type": "object"
                      }
                    },
                    "required": [
                      "id",
                      "revision",
                      "params"
                    ],
                    "additionalProperties": false
                  }
                },
                "context": {
                  "type": "object",
                  "properties": {
                    "storeId": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "storeId"
                  ],
                  "additionalProperties": false
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
                "panelState": {
                  "enum": [
                    "open",
                    "closed"
                  ]
                },
                "closedAt": {
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
                "baseRevisionAtOpen": {
                  "type": "integer",
                  "minimum": 1
                },
                "selectedSourceRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "viewRevision": {
                  "type": "integer",
                  "minimum": 1
                },
                "activeBuildId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "lastGoodBuildId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "previousGoodBuildId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "pendingPublicationId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "validationStatus": {
                  "enum": [
                    "draft_unpublished",
                    "legacy_unverified",
                    "verified",
                    "failed"
                  ]
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
            "sourceRefs": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "revision",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "context": {
              "type": "object",
              "properties": {
                "storeId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "storeId"
              ],
              "additionalProperties": false
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
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
        },
        "newCopy": {
          "type": "boolean"
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
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        "panelState": {
          "enum": [
            "open",
            "closed"
          ]
        },
        "closedAt": {
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
        "baseRevisionAtOpen": {
          "type": "integer",
          "minimum": 1
        },
        "selectedSourceRevision": {
          "type": "integer",
          "minimum": 1
        },
        "viewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "activeBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "lastGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "previousGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "pendingPublicationId": {
          "type": [
            "string",
            "null"
          ]
        },
        "validationStatus": {
          "enum": [
            "draft_unpublished",
            "legacy_unverified",
            "verified",
            "failed"
          ]
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
      "timeoutMs": 150000,
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
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        "panelState": {
          "enum": [
            "open",
            "closed"
          ]
        },
        "closedAt": {
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
        "baseRevisionAtOpen": {
          "type": "integer",
          "minimum": 1
        },
        "selectedSourceRevision": {
          "type": "integer",
          "minimum": 1
        },
        "viewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "activeBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "lastGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "previousGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "pendingPublicationId": {
          "type": [
            "string",
            "null"
          ]
        },
        "validationStatus": {
          "enum": [
            "draft_unpublished",
            "legacy_unverified",
            "verified",
            "failed"
          ]
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
      "timeoutMs": 150000,
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
    "capabilityId": "apps.presentation.register_data_source",
    "version": "1.0.0",
    "title": "registerDataSource",
    "description": "Shared component registerDataSource. Builds and drafts remain separate from explicit saved assets.",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "definition": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "description": {
              "type": "string"
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
            "storeScoped": {
              "type": "boolean"
            },
            "input": {
              "type": "object"
            },
            "rowsPath": {
              "type": "string"
            },
            "parameters": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1
                  },
                  "label": {
                    "type": "string",
                    "minLength": 1
                  },
                  "type": {
                    "enum": [
                      "string",
                      "number",
                      "integer",
                      "boolean"
                    ]
                  },
                  "required": {
                    "type": "boolean"
                  },
                  "default": {},
                  "linked": {
                    "type": "boolean"
                  },
                  "editable": {
                    "type": "boolean"
                  },
                  "choices": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                      "type": "object",
                      "properties": {
                        "label": {
                          "type": "string",
                          "minLength": 1
                        },
                        "value": {
                          "type": [
                            "string",
                            "number",
                            "boolean"
                          ]
                        }
                      },
                      "required": [
                        "label",
                        "value"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "name",
                  "label",
                  "type"
                ],
                "additionalProperties": false
              }
            },
            "fields": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "object",
                "properties": {
                  "key": {
                    "type": "string",
                    "minLength": 1
                  },
                  "origin": {
                    "type": "object",
                    "properties": {
                      "source": {
                        "type": "string",
                        "minLength": 1
                      },
                      "label": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "source",
                      "label"
                    ],
                    "additionalProperties": false
                  },
                  "path": {
                    "type": "string",
                    "minLength": 1
                  },
                  "role": {
                    "type": "string",
                    "minLength": 1
                  },
                  "confirmed": {
                    "type": "boolean"
                  },
                  "label": {
                    "type": "string",
                    "minLength": 1
                  },
                  "description": {
                    "type": "string"
                  },
                  "unit": {
                    "type": "string",
                    "minLength": 1
                  },
                  "currency": {
                    "type": "string",
                    "minLength": 1
                  },
                  "currencyPath": {
                    "type": "string",
                    "minLength": 1
                  },
                  "percentScale": {
                    "enum": [
                      "fraction",
                      "whole"
                    ]
                  },
                  "numericScale": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  }
                },
                "required": [
                  "path",
                  "role",
                  "confirmed"
                ],
                "additionalProperties": false
              }
            },
            "operations": {
              "type": "object",
              "properties": {
                "pagination": {
                  "type": "object",
                  "properties": {
                    "cursorParam": {
                      "type": "string",
                      "minLength": 1
                    },
                    "limitParam": {
                      "type": "string",
                      "minLength": 1
                    },
                    "nextCursorPath": {
                      "type": "string",
                      "minLength": 1
                    },
                    "totalPath": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "cursorParam"
                  ],
                  "additionalProperties": false
                },
                "search": {
                  "type": "object",
                  "properties": {
                    "scope": {
                      "enum": [
                        "server",
                        "loaded"
                      ]
                    },
                    "param": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "scope"
                  ],
                  "additionalProperties": false
                },
                "sort": {
                  "type": "object",
                  "properties": {
                    "scope": {
                      "enum": [
                        "server",
                        "loaded"
                      ]
                    },
                    "param": {
                      "type": "string",
                      "minLength": 1
                    },
                    "directionParam": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "scope"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "search",
                "sort"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "title",
            "appId",
            "connectionId",
            "capabilityId",
            "capabilityMajor",
            "input",
            "parameters",
            "fields",
            "rowsPath",
            "operations"
          ],
          "additionalProperties": false
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 0
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
        },
        "params": {
          "type": "object"
        }
      },
      "required": [
        "definition"
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
        "title": {
          "type": "string",
          "minLength": 1
        },
        "description": {
          "type": "string"
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
        "storeScoped": {
          "type": "boolean"
        },
        "input": {
          "type": "object"
        },
        "rowsPath": {
          "type": "string"
        },
        "parameters": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1
              },
              "label": {
                "type": "string",
                "minLength": 1
              },
              "type": {
                "enum": [
                  "string",
                  "number",
                  "integer",
                  "boolean"
                ]
              },
              "required": {
                "type": "boolean"
              },
              "default": {},
              "linked": {
                "type": "boolean"
              },
              "editable": {
                "type": "boolean"
              },
              "choices": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "type": "object",
                  "properties": {
                    "label": {
                      "type": "string",
                      "minLength": 1
                    },
                    "value": {
                      "type": [
                        "string",
                        "number",
                        "boolean"
                      ]
                    }
                  },
                  "required": [
                    "label",
                    "value"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "name",
              "label",
              "type"
            ],
            "additionalProperties": false
          }
        },
        "fields": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "properties": {
              "key": {
                "type": "string",
                "minLength": 1
              },
              "origin": {
                "type": "object",
                "properties": {
                  "source": {
                    "type": "string",
                    "minLength": 1
                  },
                  "label": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "source",
                  "label"
                ],
                "additionalProperties": false
              },
              "path": {
                "type": "string",
                "minLength": 1
              },
              "role": {
                "type": "string",
                "minLength": 1
              },
              "confirmed": {
                "type": "boolean"
              },
              "label": {
                "type": "string",
                "minLength": 1
              },
              "description": {
                "type": "string"
              },
              "unit": {
                "type": "string",
                "minLength": 1
              },
              "currency": {
                "type": "string",
                "minLength": 1
              },
              "currencyPath": {
                "type": "string",
                "minLength": 1
              },
              "percentScale": {
                "enum": [
                  "fraction",
                  "whole"
                ]
              },
              "numericScale": {
                "type": "number",
                "exclusiveMinimum": 0
              }
            },
            "required": [
              "path",
              "role",
              "confirmed"
            ],
            "additionalProperties": false
          }
        },
        "operations": {
          "type": "object",
          "properties": {
            "pagination": {
              "type": "object",
              "properties": {
                "cursorParam": {
                  "type": "string",
                  "minLength": 1
                },
                "limitParam": {
                  "type": "string",
                  "minLength": 1
                },
                "nextCursorPath": {
                  "type": "string",
                  "minLength": 1
                },
                "totalPath": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "cursorParam"
              ],
              "additionalProperties": false
            },
            "search": {
              "type": "object",
              "properties": {
                "scope": {
                  "enum": [
                    "server",
                    "loaded"
                  ]
                },
                "param": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "scope"
              ],
              "additionalProperties": false
            },
            "sort": {
              "type": "object",
              "properties": {
                "scope": {
                  "enum": [
                    "server",
                    "loaded"
                  ]
                },
                "param": {
                  "type": "string",
                  "minLength": 1
                },
                "directionParam": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "scope"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "search",
            "sort"
          ],
          "additionalProperties": false
        },
        "kind": {
          "const": "data_source"
        },
        "revision": {
          "type": "integer",
          "minimum": 1
        },
        "validation": {
          "type": "object",
          "properties": {
            "status": {
              "enum": [
                "verified",
                "failed",
                "unverified"
              ]
            },
            "checkedAt": {
              "type": "string",
              "minLength": 1
            },
            "invocationId": {
              "type": "string",
              "minLength": 1
            },
            "sampleCount": {
              "type": "integer",
              "minimum": 0
            },
            "issues": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            },
            "empty": {
              "type": "boolean"
            },
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "status",
            "checkedAt",
            "sampleCount",
            "issues"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "id",
        "title",
        "appId",
        "connectionId",
        "capabilityId",
        "capabilityMajor",
        "input",
        "parameters",
        "fields",
        "rowsPath",
        "operations",
        "kind",
        "revision",
        "validation"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 150000,
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
      "hallmark_register_data_source"
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
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        "panelState": {
          "enum": [
            "open",
            "closed"
          ]
        },
        "closedAt": {
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
        "baseRevisionAtOpen": {
          "type": "integer",
          "minimum": 1
        },
        "selectedSourceRevision": {
          "type": "integer",
          "minimum": 1
        },
        "viewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "activeBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "lastGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "previousGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "pendingPublicationId": {
          "type": [
            "string",
            "null"
          ]
        },
        "validationStatus": {
          "enum": [
            "draft_unpublished",
            "legacy_unverified",
            "verified",
            "failed"
          ]
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
      "timeoutMs": 150000,
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
    "capabilityId": "apps.presentation.resolve_data_source",
    "version": "1.0.0",
    "title": "resolveDataSource",
    "description": "Shared component resolveDataSource. Builds and drafts remain separate from explicit saved assets.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "revision": {
          "type": "integer",
          "minimum": 1
        },
        "bindingId": {
          "type": "string",
          "minLength": 1
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
        },
        "params": {
          "type": "object"
        }
      },
      "required": [
        "id",
        "revision",
        "bindingId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
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
        "sourceRef": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "revision": {
              "type": "integer",
              "minimum": 1
            },
            "params": {
              "type": "object"
            }
          },
          "required": [
            "id",
            "revision",
            "params"
          ],
          "additionalProperties": false
        },
        "fieldMap": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "fieldMeta": {
          "type": "object"
        },
        "rowsPath": {
          "type": "string"
        }
      },
      "required": [
        "binding",
        "sourceRef",
        "fieldMap",
        "fieldMeta",
        "rowsPath"
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
      "hallmark_resolve_data_source"
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
            "sourceRefs": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "revision": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "params": {
                    "type": "object"
                  }
                },
                "required": [
                  "id",
                  "revision",
                  "params"
                ],
                "additionalProperties": false
              }
            },
            "context": {
              "type": "object",
              "properties": {
                "storeId": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "storeId"
              ],
              "additionalProperties": false
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
            "panelState": {
              "enum": [
                "open",
                "closed"
              ]
            },
            "closedAt": {
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
            "baseRevisionAtOpen": {
              "type": "integer",
              "minimum": 1
            },
            "selectedSourceRevision": {
              "type": "integer",
              "minimum": 1
            },
            "viewRevision": {
              "type": "integer",
              "minimum": 1
            },
            "activeBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "lastGoodBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "previousGoodBuildId": {
              "type": [
                "string",
                "null"
              ]
            },
            "pendingPublicationId": {
              "type": [
                "string",
                "null"
              ]
            },
            "validationStatus": {
              "enum": [
                "draft_unpublished",
                "legacy_unverified",
                "verified",
                "failed"
              ]
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
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        },
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        "sourceRefs": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "params": {
                "type": "object"
              }
            },
            "required": [
              "id",
              "revision",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
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
        "panelState": {
          "enum": [
            "open",
            "closed"
          ]
        },
        "closedAt": {
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
        "baseRevisionAtOpen": {
          "type": "integer",
          "minimum": 1
        },
        "selectedSourceRevision": {
          "type": "integer",
          "minimum": 1
        },
        "viewRevision": {
          "type": "integer",
          "minimum": 1
        },
        "activeBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "lastGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "previousGoodBuildId": {
          "type": [
            "string",
            "null"
          ]
        },
        "pendingPublicationId": {
          "type": [
            "string",
            "null"
          ]
        },
        "validationStatus": {
          "enum": [
            "draft_unpublished",
            "legacy_unverified",
            "verified",
            "failed"
          ]
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
    "capabilityId": "apps.presentation.validate_data_source",
    "version": "1.0.0",
    "title": "validateDataSource",
    "description": "Shared component validateDataSource. Builds and drafts remain separate from explicit saved assets.",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "definition": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "title": {
              "type": "string",
              "minLength": 1
            },
            "description": {
              "type": "string"
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
            "storeScoped": {
              "type": "boolean"
            },
            "input": {
              "type": "object"
            },
            "rowsPath": {
              "type": "string"
            },
            "parameters": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1
                  },
                  "label": {
                    "type": "string",
                    "minLength": 1
                  },
                  "type": {
                    "enum": [
                      "string",
                      "number",
                      "integer",
                      "boolean"
                    ]
                  },
                  "required": {
                    "type": "boolean"
                  },
                  "default": {},
                  "linked": {
                    "type": "boolean"
                  },
                  "editable": {
                    "type": "boolean"
                  },
                  "choices": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                      "type": "object",
                      "properties": {
                        "label": {
                          "type": "string",
                          "minLength": 1
                        },
                        "value": {
                          "type": [
                            "string",
                            "number",
                            "boolean"
                          ]
                        }
                      },
                      "required": [
                        "label",
                        "value"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "name",
                  "label",
                  "type"
                ],
                "additionalProperties": false
              }
            },
            "fields": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "object",
                "properties": {
                  "key": {
                    "type": "string",
                    "minLength": 1
                  },
                  "origin": {
                    "type": "object",
                    "properties": {
                      "source": {
                        "type": "string",
                        "minLength": 1
                      },
                      "label": {
                        "type": "string",
                        "minLength": 1
                      }
                    },
                    "required": [
                      "source",
                      "label"
                    ],
                    "additionalProperties": false
                  },
                  "path": {
                    "type": "string",
                    "minLength": 1
                  },
                  "role": {
                    "type": "string",
                    "minLength": 1
                  },
                  "confirmed": {
                    "type": "boolean"
                  },
                  "label": {
                    "type": "string",
                    "minLength": 1
                  },
                  "description": {
                    "type": "string"
                  },
                  "unit": {
                    "type": "string",
                    "minLength": 1
                  },
                  "currency": {
                    "type": "string",
                    "minLength": 1
                  },
                  "currencyPath": {
                    "type": "string",
                    "minLength": 1
                  },
                  "percentScale": {
                    "enum": [
                      "fraction",
                      "whole"
                    ]
                  },
                  "numericScale": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  }
                },
                "required": [
                  "path",
                  "role",
                  "confirmed"
                ],
                "additionalProperties": false
              }
            },
            "operations": {
              "type": "object",
              "properties": {
                "pagination": {
                  "type": "object",
                  "properties": {
                    "cursorParam": {
                      "type": "string",
                      "minLength": 1
                    },
                    "limitParam": {
                      "type": "string",
                      "minLength": 1
                    },
                    "nextCursorPath": {
                      "type": "string",
                      "minLength": 1
                    },
                    "totalPath": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "cursorParam"
                  ],
                  "additionalProperties": false
                },
                "search": {
                  "type": "object",
                  "properties": {
                    "scope": {
                      "enum": [
                        "server",
                        "loaded"
                      ]
                    },
                    "param": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "scope"
                  ],
                  "additionalProperties": false
                },
                "sort": {
                  "type": "object",
                  "properties": {
                    "scope": {
                      "enum": [
                        "server",
                        "loaded"
                      ]
                    },
                    "param": {
                      "type": "string",
                      "minLength": 1
                    },
                    "directionParam": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "scope"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "search",
                "sort"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "title",
            "appId",
            "connectionId",
            "capabilityId",
            "capabilityMajor",
            "input",
            "parameters",
            "fields",
            "rowsPath",
            "operations"
          ],
          "additionalProperties": false
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 0
        },
        "context": {
          "type": "object",
          "properties": {
            "storeId": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "storeId"
          ],
          "additionalProperties": false
        },
        "params": {
          "type": "object"
        }
      },
      "required": [
        "definition"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "verified",
            "failed",
            "unverified"
          ]
        },
        "checkedAt": {
          "type": "string",
          "minLength": 1
        },
        "invocationId": {
          "type": "string",
          "minLength": 1
        },
        "sampleCount": {
          "type": "integer",
          "minimum": 0
        },
        "issues": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "empty": {
          "type": "boolean"
        },
        "storeId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "status",
        "checkedAt",
        "sampleCount",
        "issues"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 150000,
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
      "hallmark_validate_data_source"
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
    "description": "普通调价通过统一经营变更引擎，程序精确读取商品身份及当前价格、审核确定规则、记录逐行结果。无需审阅声明或手填幂等键；返回经营变更单。写入直接使用经营应用保存的店铺连接，不依赖旧平台任务；持久化原请求后只发送一次，保留凭据版本供只读核查。actionId 不会转换为普通调价，应使用 promotion.update 并明确活动配额。pending/unknown 只 inspect 原操作，不重新提交。",
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
          "description": "可选旧记录字段；程序不要求值来源声明"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选旧调用幂等键；未提供时程序自动管理，未知结果只查询原操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选经营说明；无需重复记录授权原话"
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
      "required": [
        "storeId",
        "price"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 300000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "upstream_supported",
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
    "capabilityId": "hallmark.collected.skus",
    "version": "1.0.0",
    "title": "采集商品 SKU 明细",
    "description": "读取已有采集商品的结构化SKU规格、价格与币种，不进行选品评估或业务写入。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "itemId": {
          "type": "string",
          "minLength": 1
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
        }
      },
      "required": [
        "items",
        "total"
      ],
      "additionalProperties": false
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
        "sku",
        "规格",
        "素材库"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.collection.read",
    "version": "1.0.0",
    "title": "读取精简采集资料",
    "description": "默认返回可用于上品的精简事实：公共属性、真实包装、采购价含义、SKU差异表和主图。SKU每页最多40行，描述首1500字，批量受响应预算限制；未知与可继续读取分开。无需先搜索已知商品ID。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        },
        "skuIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        },
        "selections": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "skuIds": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                },
                "minItems": 1
              },
              "cursor": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "minItems": 1
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "revision": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 40
        },
        "maxBytes": {
          "type": "integer",
          "minimum": 1024,
          "maximum": 65536
        },
        "refresh": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "采集箱",
        "商品",
        "sku",
        "上品",
        "图片",
        "read"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.collection.resource.read",
    "version": "1.0.0",
    "title": "查看素材与依据",
    "description": "按短素材编号下载图片并返回当前执行环境可查看的文件，或展开SKU/详情图片、描述、原始资料指定路径。太大时给目录或续页，不截断JSON。完整原始资料仅用于具体追查。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "enum": [
            "raw",
            "description",
            "images",
            "image"
          ]
        },
        "path": {
          "type": "string"
        },
        "assetId": {
          "type": "string",
          "minLength": 1
        },
        "role": {
          "enum": [
            "main",
            "sku",
            "detail"
          ]
        },
        "skuIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "revision": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "maxBytes": {
          "type": "integer",
          "minimum": 1024,
          "maximum": 65536
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "采集箱",
        "商品",
        "sku",
        "上品",
        "图片",
        "resource.read"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.collection.search",
    "version": "1.0.0",
    "title": "搜索采集商品",
    "description": "搜索采集商品事实，默认每页30张精简卡片；关键词不匹配旧任务文本。价格明确采购价或来源展示售价。用户找未上商品时推荐 store.listingRecord=not_found；found含保存的上品草稿及失败/归档记录，unavailable表示读取未完成，不能当无记录。recordLookup解释查询口径与失败原因；新记录筛选无法确定总数时total=null，knownMatches仅为已知匹配。不要轮流试旧status和association来猜未上。旧store.status仅兼容历史成功铺货覆盖度，store.saleState筛当前在售/无库存/归档等，store.association筛采购关联，条件在分页统计前组合。店铺saleStates按去重销售商品offer计数，不是来源SKU数；过期或缺失观察为unknown。返回全量匹配统计与续页。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        },
        "source": {
          "type": "string",
          "minLength": 1
        },
        "category": {
          "type": "string",
          "minLength": 1
        },
        "price": {
          "type": "object",
          "properties": {
            "meaning": {
              "enum": [
                "purchase_cost",
                "source_display_price"
              ]
            },
            "currency": {
              "type": "string",
              "minLength": 1
            },
            "min": {
              "type": "number"
            },
            "max": {
              "type": "number"
            }
          },
          "required": [
            "meaning",
            "currency"
          ],
          "additionalProperties": false
        },
        "store": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "listingRecord": {
              "enum": [
                "found",
                "not_found",
                "unavailable"
              ],
              "description": "推荐选品条件：found=本店有记录（含草稿、失败、归档）；not_found=已完成记录查询但未找到，可作上品候选，不证明历史从未上架；unavailable=记录暂不可查。"
            },
            "status": {
              "enum": [
                "listed",
                "partial",
                "not_listed",
                "unknown"
              ]
            },
            "saleState": {
              "enum": [
                "on_sale",
                "out_of_stock",
                "pending",
                "archived",
                "failed",
                "not_sellable",
                "unknown"
              ]
            },
            "association": {
              "enum": [
                "linked",
                "none",
                "unknown"
              ]
            }
          },
          "required": [
            "id"
          ],
          "additionalProperties": false
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "refresh": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "采集箱",
        "商品",
        "sku",
        "上品",
        "图片",
        "search"
      ]
    },
    "aliases": []
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
      "concurrency": "declared_safe",
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
    "capabilityId": "hallmark.listing.assets.publish",
    "version": "1.0.0",
    "title": "交付上品图片",
    "description": "将明确选中的本机 PNG、JPEG 或 WebP 成品图片交付为平台可读公网地址。程序自动导入、缓存和核对实际图片；同一内容重复调用可复用。返回逐文件地址、内容版本及 SKU 关联，失败不影响其他已成功图片。用于草稿素材，不提交 Ozon 商品。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "files": {
          "type": "array",
          "minItems": 1,
          "maxItems": 20,
          "items": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string",
                "minLength": 1
              },
              "skuIds": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            },
            "required": [
              "path"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "files"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 300000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "upstream_supported",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "上品",
        "图片",
        "素材",
        "主图",
        "发布图片"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.listing.draft.create",
    "version": "1.0.0",
    "title": "创建经营草稿",
    "description": "保存一张经营操作表，不触发模型或平台提交。程序读取原商品与采购SKU、绑定组成并补齐确定性数据。payload填写一次：价格 price/currency_code；库存 stock/warehouse_id；归档 archived；活动 action_id/price/stock（活动配额）；listing为原生Ozon item。上品procurement引用完整来源itemId/sourceSkuId及quantity。多主体参考图可在行级referenceSubjects填写真实sourceImageUrl和主体位置，例如“左侧银色贴片”；单一明确主体可省略。它只指定比较对象，不手填采购价或审核声明。",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rowId": {
                "type": "string",
                "minLength": 1
              },
              "action": {
                "enum": [
                  "price",
                  "stock",
                  "archive",
                  "promotion.enroll",
                  "promotion.update",
                  "promotion.exit",
                  "listing"
                ]
              },
              "target": {
                "type": "object",
                "properties": {
                  "offerId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "productId": {
                    "type": [
                      "string",
                      "number"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "number"
                    ]
                  }
                },
                "required": [
                  "offerId"
                ],
                "additionalProperties": false
              },
              "payload": {
                "type": "object",
                "additionalProperties": true
              },
              "procurement": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "itemId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "sourceSkuId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "quantity": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "itemId",
                    "sourceSkuId",
                    "quantity"
                  ],
                  "additionalProperties": false
                }
              },
              "referenceSubjects": {
                "type": "array",
                "maxItems": 8,
                "items": {
                  "type": "object",
                  "properties": {
                    "sourceImageUrl": {
                      "type": "string",
                      "minLength": 1
                    },
                    "subject": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 500
                    }
                  },
                  "required": [
                    "sourceImageUrl",
                    "subject"
                  ],
                  "additionalProperties": false
                }
              },
              "pricing": {
                "type": "object",
                "properties": {
                  "planId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "mode": {
                    "enum": [
                      "automatic",
                      "manual"
                    ]
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              },
              "dependsOn": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            },
            "required": [
              "action",
              "target",
              "payload"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 200
        }
      },
      "required": [
        "storeId",
        "rows"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "create"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.listing.draft.get",
    "version": "1.0.0",
    "title": "读取经营变更单",
    "description": "读取一张经营变更单，或凭原runtime operationId找到它。默认精简表格；includeEvidence可读取完整来源和审核证据，不执行平台写入。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        },
        "operationId": {
          "type": "string",
          "minLength": 1
        },
        "includeEvidence": {
          "type": "boolean"
        },
        "rowIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
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
      "required": [],
      "additionalProperties": false,
      "oneOf": [
        {
          "required": [
            "planId"
          ],
          "not": {
            "required": [
              "operationId"
            ]
          }
        },
        {
          "required": [
            "operationId"
          ],
          "not": {
            "required": [
              "planId"
            ]
          }
        }
      ]
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "get"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.listing.draft.revise",
    "version": "1.0.0",
    "title": "修改经营草稿",
    "description": "按稳定rowId修改尚未执行的行，程序更新版本和受影响的审核依赖。rows每项提供完整目标行；成功或未决行不可改写。草稿保存不调用模型。",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 1
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rowId": {
                "type": "string",
                "minLength": 1
              },
              "action": {
                "enum": [
                  "price",
                  "stock",
                  "archive",
                  "promotion.enroll",
                  "promotion.update",
                  "promotion.exit",
                  "listing"
                ]
              },
              "target": {
                "type": "object",
                "properties": {
                  "offerId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "productId": {
                    "type": [
                      "string",
                      "number"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "number"
                    ]
                  }
                },
                "required": [
                  "offerId"
                ],
                "additionalProperties": false
              },
              "payload": {
                "type": "object",
                "additionalProperties": true
              },
              "procurement": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "itemId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "sourceSkuId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "quantity": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "itemId",
                    "sourceSkuId",
                    "quantity"
                  ],
                  "additionalProperties": false
                }
              },
              "referenceSubjects": {
                "type": "array",
                "maxItems": 8,
                "items": {
                  "type": "object",
                  "properties": {
                    "sourceImageUrl": {
                      "type": "string",
                      "minLength": 1
                    },
                    "subject": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 500
                    }
                  },
                  "required": [
                    "sourceImageUrl",
                    "subject"
                  ],
                  "additionalProperties": false
                }
              },
              "pricing": {
                "type": "object",
                "properties": {
                  "planId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "mode": {
                    "enum": [
                      "automatic",
                      "manual"
                    ]
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              },
              "dependsOn": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            },
            "required": [
              "action",
              "target",
              "payload"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 200
        }
      },
      "required": [
        "planId",
        "expectedRevision",
        "rows"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "revise"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.listing.draft.submit",
    "version": "1.0.0",
    "title": "审核并提交经营变更",
    "description": "明确提交当前草稿版本。规则可确定的直接执行；图文/语义由独立模型审核，必要时Host启动独立子代理。通过行自动执行。缺事实只返回具体字段问题；无需userRequest/valueSource/scopeConfirmed或已审阅声明。程序负责行级幂等；pending/unknown仅inspect，勿另建同目标重复操作。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 1
        }
      },
      "required": [
        "planId",
        "expectedRevision"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 900000,
      "concurrency": "exclusive",
      "lockScope": "resources",
      "idempotency": "upstream_supported",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "submit"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.listing.prepare",
    "version": "1.0.0",
    "title": "准备上品资料",
    "description": "给目标店铺与已选商品/SKU，程序一次组合精简采集资料、采购组成、包装结果、经营规则、已有商品关联和类目候选/模板。支持多SKU组合销售；已有资料版本可复用。整个响应受字节预算限制，续页仅传 continuation.input，无需重读已返回资料；类目默认给必填约束，其余字段可按需展开。只准备数据，不审核、不生成检查声明；Agent接着制作标题、属性和图片，再保存草稿。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "selections": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "skuIds": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                },
                "minItems": 1
              },
              "cursor": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 30
        },
        "compositions": {
          "type": "array",
          "minItems": 1,
          "maxItems": 200,
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1
              },
              "members": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "itemId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "sourceSkuId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "quantity": {
                      "type": "integer",
                      "minimum": 1
                    }
                  },
                  "required": [
                    "itemId",
                    "sourceSkuId",
                    "quantity"
                  ],
                  "additionalProperties": false
                },
                "minItems": 1,
                "maxItems": 100
              }
            },
            "required": [
              "id",
              "members"
            ],
            "additionalProperties": false
          }
        },
        "knownRevisions": {
          "type": "object",
          "additionalProperties": {
            "type": "string",
            "minLength": 1
          }
        },
        "categoryQuery": {
          "type": "string",
          "minLength": 1
        },
        "categories": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "descriptionCategoryId": {
                "type": "string",
                "minLength": 1
              },
              "typeId": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "descriptionCategoryId",
              "typeId"
            ],
            "additionalProperties": false
          }
        },
        "maxBytes": {
          "type": "integer",
          "minimum": 2048,
          "maximum": 65536
        },
        "salesLimit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "refresh": {
          "type": "boolean"
        },
        "includeOptionalAttributes": {
          "type": "boolean"
        }
      },
      "required": [
        "storeId"
      ],
      "oneOf": [
        {
          "required": [
            "selections"
          ]
        },
        {
          "required": [
            "cursor"
          ]
        }
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 120000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "上品",
        "准备",
        "批量",
        "组合",
        "采购"
      ]
    },
    "aliases": []
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
      "anyOf": [
        {
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
        {
          "type": "object",
          "properties": {
            "planId": {
              "type": "string",
              "minLength": 1
            },
            "storeId": {
              "type": "string",
              "minLength": 1
            },
            "status": {
              "type": "string",
              "minLength": 1
            },
            "revision": {
              "type": "integer",
              "minimum": 0
            },
            "rows": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": true
              }
            }
          },
          "required": [
            "planId",
            "storeId",
            "status",
            "revision",
            "rows"
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
    "capabilityId": "hallmark.ozon.analytics",
    "version": "1.0.0",
    "title": "Ozon 商品流量与订购表现",
    "description": "按 SKU 与日期读取自有商品表现；可选择按商品汇总整个期间。不包含选品数据。日期须截至昨天，最长90天。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "dateFrom": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "dateTo": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "groupBy": {
          "enum": [
            "day",
            "sku"
          ]
        }
      },
      "required": [
        "storeId",
        "dateFrom",
        "dateTo"
      ],
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
              "sku": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 为商品分配的 SKU。"
              },
              "title": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的商品名称。"
              },
              "date": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台统计或记账日期。"
              },
              "impressions": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品在搜索结果和分类页面的曝光次数。"
              },
              "views": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品详情页被浏览的次数。"
              },
              "cartEvents": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品被加入购物车的次数。"
              },
              "orderedUnits": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "统计期间下单订购的商品件数，包含尚未完成的订单。"
              },
              "visitors": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品详情页的访问会话次数，跨日汇总不代表去重人数。"
              }
            },
            "required": [
              "sku",
              "title",
              "date",
              "impressions",
              "views",
              "cartEvents",
              "orderedUnits",
              "visitors"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "商品流量与订购表现"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.compose",
    "version": "1.0.0",
    "title": "Ozon 跨接口组合数据",
    "description": "按商品或包裹组合已封装接口字段。统一店铺，完整读取关联页后分页；费用只允许包裹粒度，不推测商品分摊。字段目录和组合定义可供工作台、Agent、源码组件复用。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "recipe": {
          "type": "object",
          "properties": {
            "version": {
              "const": 1
            },
            "grain": {
              "enum": [
                "product",
                "posting"
              ]
            },
            "fields": {
              "type": "array",
              "minItems": 1,
              "maxItems": 30,
              "uniqueItems": true,
              "items": {
                "enum": [
                  "products.productId",
                  "products.offerId",
                  "products.sku",
                  "products.title",
                  "products.image",
                  "products.status",
                  "products.statusCode",
                  "products.statusRaw",
                  "products.errorReason",
                  "prices.productId",
                  "prices.offerId",
                  "prices.price",
                  "prices.ordinaryPrice",
                  "prices.oldPrice",
                  "prices.currency",
                  "warehouses.warehouseId",
                  "warehouses.warehouseName",
                  "warehouses.fulfillment",
                  "warehouses.status",
                  "warehouses.statusCode",
                  "warehouses.statusRaw",
                  "warehouses.deliveryMethods",
                  "stocks.productId",
                  "stocks.sku",
                  "stocks.offerId",
                  "stocks.warehouseId",
                  "stocks.warehouseName",
                  "stocks.stockPresent",
                  "stocks.stockReserved",
                  "stocks.stockAvailable",
                  "analytics.sku",
                  "analytics.title",
                  "analytics.date",
                  "analytics.impressions",
                  "analytics.views",
                  "analytics.cartEvents",
                  "analytics.orderedUnits",
                  "analytics.visitors",
                  "orders.orderId",
                  "orders.orderNumber",
                  "orders.postingNumber",
                  "orders.sku",
                  "orders.offerId",
                  "orders.title",
                  "orders.quantity",
                  "orders.orderPrice",
                  "orders.currency",
                  "orders.status",
                  "orders.statusCode",
                  "orders.statusRaw",
                  "orders.createdAt",
                  "orders.shipmentAt",
                  "orders.trackingNumber",
                  "weights.postingNumber",
                  "weights.sku",
                  "weights.offerId",
                  "weights.quantity",
                  "weights.actualWeight",
                  "weights.declaredWeight",
                  "weights.weightDifference",
                  "weights.weightScope",
                  "weights.shipmentAt",
                  "finance.accrualId",
                  "finance.unitNumber",
                  "finance.postingNumber",
                  "finance.date",
                  "finance.accrualType",
                  "finance.amount",
                  "finance.commission",
                  "finance.logisticsFee",
                  "finance.feeDetails",
                  "finance.currency",
                  "promotions.actionId",
                  "promotions.actionName",
                  "promotions.productId",
                  "promotions.participation",
                  "promotions.actionPrice",
                  "promotions.maxActionPrice",
                  "promotions.currency",
                  "promotions.startsAt",
                  "promotions.endsAt",
                  "returns.returnId",
                  "returns.postingNumber",
                  "returns.orderId",
                  "returns.orderNumber",
                  "returns.sku",
                  "returns.offerId",
                  "returns.title",
                  "returns.quantity",
                  "returns.returnReason",
                  "returns.status",
                  "returns.statusCode",
                  "returns.statusRaw",
                  "returns.createdAt",
                  "returns.orderPrice",
                  "returns.currency"
                ]
              }
            }
          },
          "required": [
            "version",
            "grain",
            "fields"
          ],
          "additionalProperties": false
        },
        "dateFrom": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "dateTo": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "warehouseId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        },
        "actionId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        },
        "participation": {
          "enum": [
            "joined",
            "eligible"
          ]
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        }
      },
      "required": [
        "storeId",
        "recipe"
      ],
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
              "products": {
                "type": "object",
                "properties": {
                  "productId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "offerId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "title": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "image": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "status": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusCode": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusRaw": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "errorReason": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "productId",
                  "offerId",
                  "sku",
                  "title",
                  "image",
                  "status",
                  "statusCode",
                  "statusRaw",
                  "errorReason"
                ],
                "additionalProperties": false
              },
              "prices": {
                "type": "object",
                "properties": {
                  "productId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "offerId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "price": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "ordinaryPrice": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "oldPrice": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "currency": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "productId",
                  "offerId",
                  "price",
                  "ordinaryPrice",
                  "oldPrice",
                  "currency"
                ],
                "additionalProperties": false
              },
              "warehouses": {
                "type": "object",
                "properties": {
                  "warehouseId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "warehouseName": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "fulfillment": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "status": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusCode": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusRaw": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "deliveryMethods": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "warehouseId",
                  "warehouseName",
                  "fulfillment",
                  "status",
                  "statusCode",
                  "statusRaw",
                  "deliveryMethods"
                ],
                "additionalProperties": false
              },
              "stocks": {
                "type": "object",
                "properties": {
                  "productId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "offerId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "warehouseId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "warehouseName": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "stockPresent": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "stockReserved": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "stockAvailable": {
                    "type": [
                      "number",
                      "null"
                    ]
                  }
                },
                "required": [
                  "productId",
                  "sku",
                  "offerId",
                  "warehouseId",
                  "warehouseName",
                  "stockPresent",
                  "stockReserved",
                  "stockAvailable"
                ],
                "additionalProperties": false
              },
              "analytics": {
                "type": "object",
                "properties": {
                  "sku": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "title": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "date": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "impressions": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "views": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "cartEvents": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "orderedUnits": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "visitors": {
                    "type": [
                      "number",
                      "null"
                    ]
                  }
                },
                "required": [
                  "sku",
                  "title",
                  "date",
                  "impressions",
                  "views",
                  "cartEvents",
                  "orderedUnits",
                  "visitors"
                ],
                "additionalProperties": false
              },
              "orders": {
                "type": "object",
                "properties": {
                  "orderId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "orderNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "postingNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "offerId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "title": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "quantity": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "orderPrice": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "currency": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "status": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusCode": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusRaw": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "createdAt": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "shipmentAt": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "trackingNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "orderId",
                  "orderNumber",
                  "postingNumber",
                  "sku",
                  "offerId",
                  "title",
                  "quantity",
                  "orderPrice",
                  "currency",
                  "status",
                  "statusCode",
                  "statusRaw",
                  "createdAt",
                  "shipmentAt",
                  "trackingNumber"
                ],
                "additionalProperties": false
              },
              "weights": {
                "type": "object",
                "properties": {
                  "postingNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "offerId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "quantity": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "actualWeight": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "declaredWeight": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "weightDifference": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "weightScope": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "shipmentAt": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "postingNumber",
                  "sku",
                  "offerId",
                  "quantity",
                  "actualWeight",
                  "declaredWeight",
                  "weightDifference",
                  "weightScope",
                  "shipmentAt"
                ],
                "additionalProperties": false
              },
              "finance": {
                "type": "object",
                "properties": {
                  "accrualId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "unitNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "postingNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "date": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "accrualType": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "amount": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "commission": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "logisticsFee": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "feeDetails": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "currency": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "accrualId",
                  "unitNumber",
                  "postingNumber",
                  "date",
                  "accrualType",
                  "amount",
                  "commission",
                  "logisticsFee",
                  "feeDetails",
                  "currency"
                ],
                "additionalProperties": false
              },
              "promotions": {
                "type": "object",
                "properties": {
                  "actionId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "actionName": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "productId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "participation": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "actionPrice": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "maxActionPrice": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "currency": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "startsAt": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "endsAt": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "actionId",
                  "actionName",
                  "productId",
                  "participation",
                  "actionPrice",
                  "maxActionPrice",
                  "currency",
                  "startsAt",
                  "endsAt"
                ],
                "additionalProperties": false
              },
              "returns": {
                "type": "object",
                "properties": {
                  "returnId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "postingNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "orderId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "orderNumber": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "offerId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "title": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "quantity": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "returnReason": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "status": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusCode": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "statusRaw": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "createdAt": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "orderPrice": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "currency": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "returnId",
                  "postingNumber",
                  "orderId",
                  "orderNumber",
                  "sku",
                  "offerId",
                  "title",
                  "quantity",
                  "returnReason",
                  "status",
                  "statusCode",
                  "statusRaw",
                  "createdAt",
                  "orderPrice",
                  "currency"
                ],
                "additionalProperties": false
              }
            },
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "sourceStates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "source": {
                "type": "string",
                "minLength": 1
              },
              "status": {
                "enum": [
                  "ready",
                  "empty",
                  "missing"
                ]
              },
              "rowCount": {
                "type": "integer",
                "minimum": 0
              },
              "pageCount": {
                "type": "integer",
                "minimum": 0
              },
              "dataTime": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "fetchedAt": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "cacheHit": {
                "type": "boolean"
              },
              "freshness": {
                "enum": [
                  "fresh",
                  "stale"
                ]
              },
              "cacheReason": {
                "enum": [
                  "none",
                  "ttl",
                  "rate_limit",
                  "upstream_unavailable",
                  "refresh_due"
                ]
              },
              "nextRetryAt": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "source",
              "status",
              "rowCount",
              "pageCount",
              "dataTime",
              "fetchedAt",
              "cacheHit",
              "freshness",
              "cacheReason"
            ],
            "additionalProperties": false
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        },
        "fieldMeta": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "key": {
                "type": "string",
                "minLength": 1
              },
              "source": {
                "type": "string",
                "minLength": 1
              },
              "label": {
                "type": "string",
                "minLength": 1
              },
              "description": {
                "type": "string",
                "minLength": 1
              },
              "format": {
                "type": "string",
                "minLength": 1
              },
              "currencyPath": {
                "type": "string",
                "minLength": 1
              },
              "unit": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "key",
              "source",
              "label",
              "description",
              "format"
            ],
            "additionalProperties": false
          }
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "total",
        "dataTime",
        "warnings",
        "sourceStates",
        "fieldMeta",
        "cache"
      ],
      "additionalProperties": false
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 120000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "Ozon",
        "组合",
        "跨接口",
        "字段",
        "数据源",
        "模板",
        "商品",
        "包裹"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.finance",
    "version": "1.0.0",
    "title": "Ozon 订单费用与平台记账",
    "description": "逐日读取平台记账记录，保留有符号金额和币种；不当作净利润。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "dateFrom": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "dateTo": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        }
      },
      "required": [
        "storeId",
        "dateFrom",
        "dateTo"
      ],
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
              "accrualId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "每条平台财务记账记录的编号。"
              },
              "unitNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "费用或收入关联的订单、包裹等业务编号。"
              },
              "postingNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "订单发货包裹的编号，一个订单可能包含多个包裹。"
              },
              "date": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台统计或记账日期。"
              },
              "accrualType": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台记录的收入或费用类别。"
              },
              "amount": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "平台记录的收入或扣费金额；不是店铺净利润。"
              },
              "commission": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "与记账币种一致的平台佣金合计，未提供时显示未知。"
              },
              "logisticsFee": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "平台明确列出的物流费用，未提供时显示未知。"
              },
              "feeDetails": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "各项费用的编号、金额和币种。"
              },
              "currency": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "金额使用的货币，未提供时显示未知。"
              }
            },
            "required": [
              "accrualId",
              "unitNumber",
              "postingNumber",
              "date",
              "accrualType",
              "amount",
              "commission",
              "logisticsFee",
              "feeDetails",
              "currency"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "订单费用与平台记账"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.orders",
    "version": "1.0.0",
    "title": "Ozon 订单与发货进度",
    "description": "rFBS/FBS 订单按包裹商品展开；保留商品件数和原币金额。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "dateFrom": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "dateTo": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "postingNumber": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "storeId",
        "dateFrom",
        "dateTo"
      ],
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
              "orderId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台内部用于识别订单的编号。"
              },
              "orderNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "店铺查看和核对订单时使用的订单号。"
              },
              "postingNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "订单发货包裹的编号，一个订单可能包含多个包裹。"
              },
              "sku": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 为商品分配的 SKU。"
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "卖家设置的商品货号。"
              },
              "title": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的商品名称。"
              },
              "quantity": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "该行商品的件数。"
              },
              "orderPrice": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "订单中该商品的每件价格。"
              },
              "currency": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "金额使用的货币，未提供时显示未知。"
              },
              "status": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "明确认识的状态以中文展示；其他状态标注未映射并保留原文。"
              },
              "statusCode": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的状态代码。"
              },
              "statusRaw": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的原始状态文字，供核对。"
              },
              "createdAt": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台记录的创建时间。"
              },
              "shipmentAt": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台记录的包裹交运或发货时间。"
              },
              "trackingNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "用于查询物流进度的跟踪编号。"
              }
            },
            "required": [
              "orderId",
              "orderNumber",
              "postingNumber",
              "sku",
              "offerId",
              "title",
              "quantity",
              "orderPrice",
              "currency",
              "status",
              "statusCode",
              "statusRaw",
              "createdAt",
              "shipmentAt",
              "trackingNumber"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "订单与发货进度"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.prices",
    "version": "1.0.0",
    "title": "Ozon 商品价格",
    "description": "当前卖家价、普通售价与划线价；币种由平台返回。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "productId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        }
      },
      "required": [
        "storeId"
      ],
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
              "productId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 商品编号；不同于平台 SKU。"
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "卖家设置的商品货号。"
              },
              "price": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品当前的卖家销售价格。"
              },
              "ordinaryPrice": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品设置的普通基础售价。"
              },
              "oldPrice": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品展示的划线参考价格。"
              },
              "currency": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "金额使用的货币，未提供时显示未知。"
              }
            },
            "required": [
              "productId",
              "offerId",
              "price",
              "ordinaryPrice",
              "oldPrice",
              "currency"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "商品价格"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.products",
    "version": "1.0.0",
    "title": "Ozon 商品资料与状态",
    "description": "读取店铺商品资料、平台状态和异常说明。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "productId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        },
        "sku": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        }
      },
      "required": [
        "storeId"
      ],
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
              "productId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 商品编号；不同于平台 SKU。"
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "卖家设置的商品货号。"
              },
              "sku": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 为商品分配的 SKU。"
              },
              "title": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的商品名称。"
              },
              "image": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的商品主图。"
              },
              "status": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "明确认识的状态以中文展示；其他状态标注未映射并保留原文。"
              },
              "statusCode": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的状态代码。"
              },
              "statusRaw": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的原始状态文字，供核对。"
              },
              "errorReason": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台明确返回的错误或不可售说明。"
              }
            },
            "required": [
              "productId",
              "offerId",
              "sku",
              "title",
              "image",
              "status",
              "statusCode",
              "statusRaw",
              "errorReason"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "商品资料与状态"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.promotions",
    "version": "1.0.0",
    "title": "Ozon 活动商品与活动价格",
    "description": "活动目录及指定活动商品；2026-10-13 协议切换后的兼容性须以实店返回验证。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "actionId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        },
        "participation": {
          "enum": [
            "joined",
            "eligible"
          ]
        }
      },
      "required": [
        "storeId"
      ],
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
              "actionId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 促销活动编号。"
              },
              "actionName": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台促销活动的名称。"
              },
              "productId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 商品编号；不同于平台 SKU。"
              },
              "participation": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "商品已参加活动，或符合该活动的参加条件。"
              },
              "actionPrice": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品参加活动时的价格。"
              },
              "maxActionPrice": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "参加活动所允许的最高商品价格。"
              },
              "currency": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "金额使用的货币，未提供时显示未知。"
              },
              "startsAt": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "活动开始时间。"
              },
              "endsAt": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "活动结束时间。"
              }
            },
            "required": [
              "actionId",
              "actionName",
              "productId",
              "participation",
              "actionPrice",
              "maxActionPrice",
              "currency",
              "startsAt",
              "endsAt"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "活动商品与活动价格"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.ratings",
    "version": "1.0.0",
    "title": "Ozon 商品内容评级",
    "description": "按 Ozon SKU 读取内容评级（0–100 分）并附商品状态；未返回评级保持未知。支持单 SKU 或全店分页，只读且不修改商品。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "sku": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        }
      },
      "required": [
        "storeId"
      ],
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
              "productId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 商品编号；不同于平台 SKU。"
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "卖家设置的商品货号。"
              },
              "sku": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 为商品分配的 SKU。"
              },
              "title": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的商品名称。"
              },
              "status": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "明确认识的状态以中文展示；其他状态标注未映射并保留原文。"
              },
              "statusCode": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的状态代码。"
              },
              "statusRaw": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的原始状态文字，供核对。"
              },
              "rating": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "Ozon 按 SKU 返回的商品内容评级，范围 0–100；无分数时保持未知。"
              }
            },
            "required": [
              "productId",
              "offerId",
              "sku",
              "title",
              "status",
              "statusCode",
              "statusRaw",
              "rating"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "商品内容评级"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.returns",
    "version": "1.0.0",
    "title": "Ozon rFBS 退货退款申请",
    "description": "读取 rFBS 售后申请；传入售后单编号可读详情原因。不执行退款或售后处理。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "returnId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        }
      },
      "required": [
        "storeId"
      ],
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
              "returnId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "rFBS 退货退款申请编号。"
              },
              "postingNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "订单发货包裹的编号，一个订单可能包含多个包裹。"
              },
              "orderId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台内部用于识别订单的编号。"
              },
              "orderNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "店铺查看和核对订单时使用的订单号。"
              },
              "sku": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 为商品分配的 SKU。"
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "卖家设置的商品货号。"
              },
              "title": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的商品名称。"
              },
              "quantity": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "该行商品的件数。"
              },
              "returnReason": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的退货退款原因。"
              },
              "status": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "明确认识的状态以中文展示；其他状态标注未映射并保留原文。"
              },
              "statusCode": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的状态代码。"
              },
              "statusRaw": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的原始状态文字，供核对。"
              },
              "createdAt": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台记录的创建时间。"
              },
              "orderPrice": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "订单中该商品的每件价格。"
              },
              "currency": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "金额使用的货币，未提供时显示未知。"
              }
            },
            "required": [
              "returnId",
              "postingNumber",
              "orderId",
              "orderNumber",
              "sku",
              "offerId",
              "title",
              "quantity",
              "returnReason",
              "status",
              "statusCode",
              "statusRaw",
              "createdAt",
              "orderPrice",
              "currency"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "rFBS 退货退款申请"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.stocks",
    "version": "1.0.0",
    "title": "Ozon 商品分仓库存",
    "description": "按商品和仓库展示平台库存；缺失的可售或预留数量保持未知。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "sku": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        },
        "warehouseId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        }
      },
      "required": [
        "storeId"
      ],
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
              "productId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 商品编号；不同于平台 SKU。"
              },
              "sku": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 为商品分配的 SKU。"
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "卖家设置的商品货号。"
              },
              "warehouseId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 仓库编号。"
              },
              "warehouseName": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "店铺为仓库设置的名称。"
              },
              "stockPresent": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "平台记录的仓库商品数量。"
              },
              "stockReserved": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "已经预留的商品数量。"
              },
              "stockAvailable": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "平台确认可用于销售的商品数量。"
              }
            },
            "required": [
              "productId",
              "sku",
              "offerId",
              "warehouseId",
              "warehouseName",
              "stockPresent",
              "stockReserved",
              "stockAvailable"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "商品分仓库存"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.warehouses",
    "version": "1.0.0",
    "title": "Ozon 仓库与配送渠道",
    "description": "读取仓库履约方式和对应配送渠道；仓库名称不作为规则。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "warehouseId": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$"
        }
      },
      "required": [
        "storeId"
      ],
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
              "warehouseId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 仓库编号。"
              },
              "warehouseName": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "店铺为仓库设置的名称。"
              },
              "fulfillment": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "该仓库采用的发货和配送方式。"
              },
              "status": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "明确认识的状态以中文展示；其他状态标注未映射并保留原文。"
              },
              "statusCode": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的状态代码。"
              },
              "statusRaw": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台返回的原始状态文字，供核对。"
              },
              "deliveryMethods": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "可用配送渠道及当前状态。"
              }
            },
            "required": [
              "warehouseId",
              "warehouseName",
              "fulfillment",
              "status",
              "statusCode",
              "statusRaw",
              "deliveryMethods"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "仓库与配送渠道"
      ]
    }
  },
  {
    "capabilityId": "hallmark.ozon.weights",
    "version": "1.0.0",
    "title": "Ozon 物流实重与重量差异",
    "description": "展示已核实单件商品的物流实重与申报重量差异；多件包裹不计入单品实重。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "loadAll": {
          "type": "boolean"
        },
        "forceRefresh": {
          "type": "boolean"
        },
        "dateFrom": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "dateTo": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        }
      },
      "required": [
        "storeId",
        "dateFrom",
        "dateTo"
      ],
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
              "postingNumber": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "订单发货包裹的编号，一个订单可能包含多个包裹。"
              },
              "sku": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ozon 为商品分配的 SKU。"
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "卖家设置的商品货号。"
              },
              "quantity": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "该行商品的件数。"
              },
              "actualWeight": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "承运商报告的实际重量，单位为克。"
              },
              "declaredWeight": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "商品包装申报重量，单位为克。"
              },
              "weightDifference": {
                "type": [
                  "number",
                  "null"
                ],
                "description": "物流实重减去申报重量，单位为克。"
              },
              "weightScope": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "说明该重量是否为已核实的单件商品实重。"
              },
              "shipmentAt": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "平台记录的包裹交运或发货时间。"
              }
            },
            "required": [
              "postingNumber",
              "sku",
              "offerId",
              "quantity",
              "actualWeight",
              "declaredWeight",
              "weightDifference",
              "weightScope",
              "shipmentAt"
            ],
            "additionalProperties": false
          }
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "period": {
          "type": "object",
          "properties": {
            "dateFrom": {
              "type": "string",
              "minLength": 1
            },
            "dateTo": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "dateFrom",
            "dateTo"
          ],
          "additionalProperties": false
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "items",
        "dataTime",
        "warnings"
      ],
      "additionalProperties": false
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
        "Ozon",
        "数据源",
        "物流实重与重量差异"
      ]
    }
  },
  {
    "capabilityId": "hallmark.plan.create",
    "version": "1.0.0",
    "title": "创建经营草稿",
    "description": "保存一张经营操作表，不触发模型或平台提交。程序读取原商品与采购SKU、绑定组成并补齐确定性数据。payload填写一次：价格 price/currency_code；库存 stock/warehouse_id；归档 archived；活动 action_id/price/stock（活动配额）；listing为原生Ozon item。上品procurement引用完整来源itemId/sourceSkuId及quantity。多主体参考图可在行级referenceSubjects填写真实sourceImageUrl和主体位置，例如“左侧银色贴片”；单一明确主体可省略。它只指定比较对象，不手填采购价或审核声明。",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rowId": {
                "type": "string",
                "minLength": 1
              },
              "action": {
                "enum": [
                  "price",
                  "stock",
                  "archive",
                  "promotion.enroll",
                  "promotion.update",
                  "promotion.exit",
                  "listing"
                ]
              },
              "target": {
                "type": "object",
                "properties": {
                  "offerId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "productId": {
                    "type": [
                      "string",
                      "number"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "number"
                    ]
                  }
                },
                "required": [
                  "offerId"
                ],
                "additionalProperties": false
              },
              "payload": {
                "type": "object",
                "additionalProperties": true
              },
              "procurement": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "itemId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "sourceSkuId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "quantity": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "itemId",
                    "sourceSkuId",
                    "quantity"
                  ],
                  "additionalProperties": false
                }
              },
              "referenceSubjects": {
                "type": "array",
                "maxItems": 8,
                "items": {
                  "type": "object",
                  "properties": {
                    "sourceImageUrl": {
                      "type": "string",
                      "minLength": 1
                    },
                    "subject": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 500
                    }
                  },
                  "required": [
                    "sourceImageUrl",
                    "subject"
                  ],
                  "additionalProperties": false
                }
              },
              "pricing": {
                "type": "object",
                "properties": {
                  "planId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "mode": {
                    "enum": [
                      "automatic",
                      "manual"
                    ]
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              },
              "dependsOn": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            },
            "required": [
              "action",
              "target",
              "payload"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 200
        }
      },
      "required": [
        "storeId",
        "rows"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "create"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.plan.get",
    "version": "1.0.0",
    "title": "读取经营变更单",
    "description": "读取一张经营变更单，或凭原runtime operationId找到它。默认精简表格；includeEvidence可读取完整来源和审核证据，不执行平台写入。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        },
        "operationId": {
          "type": "string",
          "minLength": 1
        },
        "includeEvidence": {
          "type": "boolean"
        },
        "rowIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
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
      "required": [],
      "additionalProperties": false,
      "oneOf": [
        {
          "required": [
            "planId"
          ],
          "not": {
            "required": [
              "operationId"
            ]
          }
        },
        {
          "required": [
            "operationId"
          ],
          "not": {
            "required": [
              "planId"
            ]
          }
        }
      ]
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "get"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.plan.inspect",
    "version": "1.0.0",
    "title": "核查原经营请求",
    "description": "只读核查原请求、异步导入及实际价格等结果，更新逐行状态；不重新发送未决平台请求。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "planId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "inspect"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.plan.list",
    "version": "1.0.0",
    "title": "经营变更记录",
    "description": "列出此连接（可筛选店铺）的经营操作记录，包含逐行价格、采购关联、审核问题和执行状态。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "list"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.plan.restore",
    "version": "1.0.0",
    "title": "恢复经营变更",
    "description": "根据已成功变更生成反向单并通过同一审核入口执行。先比较当前值是否仍为原写入值，有冲突不覆盖。库存须单独确定新目标；新上品通过归档恢复。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        },
        "rowIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      },
      "required": [
        "planId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 900000,
      "concurrency": "exclusive",
      "lockScope": "resources",
      "idempotency": "upstream_supported",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "restore"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.plan.revise",
    "version": "1.0.0",
    "title": "修改经营草稿",
    "description": "按稳定rowId修改尚未执行的行，程序更新版本和受影响的审核依赖。rows每项提供完整目标行；成功或未决行不可改写。草稿保存不调用模型。",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 1
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rowId": {
                "type": "string",
                "minLength": 1
              },
              "action": {
                "enum": [
                  "price",
                  "stock",
                  "archive",
                  "promotion.enroll",
                  "promotion.update",
                  "promotion.exit",
                  "listing"
                ]
              },
              "target": {
                "type": "object",
                "properties": {
                  "offerId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "productId": {
                    "type": [
                      "string",
                      "number"
                    ]
                  },
                  "sku": {
                    "type": [
                      "string",
                      "number"
                    ]
                  }
                },
                "required": [
                  "offerId"
                ],
                "additionalProperties": false
              },
              "payload": {
                "type": "object",
                "additionalProperties": true
              },
              "procurement": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "itemId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "sourceSkuId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "quantity": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "itemId",
                    "sourceSkuId",
                    "quantity"
                  ],
                  "additionalProperties": false
                }
              },
              "referenceSubjects": {
                "type": "array",
                "maxItems": 8,
                "items": {
                  "type": "object",
                  "properties": {
                    "sourceImageUrl": {
                      "type": "string",
                      "minLength": 1
                    },
                    "subject": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 500
                    }
                  },
                  "required": [
                    "sourceImageUrl",
                    "subject"
                  ],
                  "additionalProperties": false
                }
              },
              "pricing": {
                "type": "object",
                "properties": {
                  "planId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "mode": {
                    "enum": [
                      "automatic",
                      "manual"
                    ]
                  }
                },
                "required": [
                  "mode"
                ],
                "additionalProperties": false
              },
              "dependsOn": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            },
            "required": [
              "action",
              "target",
              "payload"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 200
        }
      },
      "required": [
        "planId",
        "expectedRevision",
        "rows"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "revise"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.plan.submit",
    "version": "1.0.0",
    "title": "审核并提交经营变更",
    "description": "明确提交当前草稿版本。规则可确定的直接执行；图文/语义由独立模型审核，必要时Host启动独立子代理。通过行自动执行。缺事实只返回具体字段问题；无需userRequest/valueSource/scopeConfirmed或已审阅声明。程序负责行级幂等；pending/unknown仅inspect，勿另建同目标重复操作。",
    "effect": "mutation",
    "inputSchema": {
      "type": "object",
      "properties": {
        "planId": {
          "type": "string",
          "minLength": 1
        },
        "expectedRevision": {
          "type": "integer",
          "minimum": 1
        }
      },
      "required": [
        "planId",
        "expectedRevision"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 900000,
      "concurrency": "exclusive",
      "lockScope": "resources",
      "idempotency": "upstream_supported",
      "completionEvidence": "readback"
    },
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "ozon",
        "经营",
        "上品",
        "调价",
        "库存",
        "归档",
        "促销",
        "草稿",
        "submit"
      ]
    },
    "aliases": []
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
    "capabilityId": "hallmark.pricing.quote",
    "version": "1.0.0",
    "title": "按采购与物流规则试算",
    "description": "按经营行读取真实采购组成与成本、包装重量和店铺规则，返回建议售价、费用明细和阻塞字段。自动按本次售价和重量匹配物流方案，重叠取总费用最高；planId仅用于旧固定方案兼容模式。不会提交平台。",
    "effect": "compute",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "row": {
          "type": "object",
          "properties": {
            "rowId": {
              "type": "string",
              "minLength": 1
            },
            "action": {
              "enum": [
                "price",
                "stock",
                "archive",
                "promotion.enroll",
                "promotion.update",
                "promotion.exit",
                "listing"
              ]
            },
            "target": {
              "type": "object",
              "properties": {
                "offerId": {
                  "type": "string",
                  "minLength": 1
                },
                "productId": {
                  "type": [
                    "string",
                    "number"
                  ]
                },
                "sku": {
                  "type": [
                    "string",
                    "number"
                  ]
                }
              },
              "required": [
                "offerId"
              ],
              "additionalProperties": false
            },
            "payload": {
              "type": "object",
              "additionalProperties": true
            },
            "procurement": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "itemId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "sourceSkuId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "quantity": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  }
                },
                "required": [
                  "itemId",
                  "sourceSkuId",
                  "quantity"
                ],
                "additionalProperties": false
              }
            },
            "referenceSubjects": {
              "type": "array",
              "maxItems": 8,
              "items": {
                "type": "object",
                "properties": {
                  "sourceImageUrl": {
                    "type": "string",
                    "minLength": 1
                  },
                  "subject": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 500
                  }
                },
                "required": [
                  "sourceImageUrl",
                  "subject"
                ],
                "additionalProperties": false
              }
            },
            "pricing": {
              "type": "object",
              "properties": {
                "planId": {
                  "type": "string",
                  "minLength": 1
                },
                "mode": {
                  "enum": [
                    "automatic",
                    "manual"
                  ]
                }
              },
              "required": [
                "mode"
              ],
              "additionalProperties": false
            },
            "dependsOn": {
              "type": "array",
              "items": {
                "type": "string",
                "minLength": 1
              }
            }
          },
          "required": [
            "action",
            "target",
            "payload"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "storeId",
        "row"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 90000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "aliases": [],
    "discovery": {
      "defaultVisible": false,
      "keywords": [
        "物流",
        "报价",
        "试算",
        "定价"
      ]
    }
  },
  {
    "capabilityId": "hallmark.pricing.read",
    "version": "1.0.0",
    "title": "读取经营规则",
    "description": "读取经营应用保存的物流渠道报价、默认方案、目标利润与实际硬底线。不会返回店铺凭据。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "storeId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "sync",
      "timeoutMs": 30000,
      "concurrency": "declared_safe",
      "lockScope": "resources",
      "idempotency": "not_applicable",
      "completionEvidence": "response"
    },
    "aliases": [],
    "discovery": {
      "defaultVisible": true,
      "keywords": [
        "物流",
        "定价",
        "利润",
        "经营规则"
      ]
    }
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
    "description": "读取店铺商品最近快照，保留原始源字段与时间；status 精确筛选后分页，query 仅作全文搜索，与 status 取交集。仅在售用 status:on_sale，禁止遍历全店再筛选",
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
          "maxLength": 4000,
          "description": "整行全文搜索，不代表精确商品状态；与 status 筛选取交集"
        },
        "status": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "按源顶层 status 精确相等筛选，例如 on_sale；缺失不匹配，不翻译或推断状态"
        },
        "fields": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "title",
              "imageUrl",
              "sku",
              "status",
              "platformStatus",
              "currency",
              "price",
              "pricing",
              "profit",
              "stock",
              "metrics",
              "sources",
              "declaredWeight",
              "storeName"
            ]
          },
          "description": "可选：只返回指定商品字段；身份字段始终保留。列表推荐 title/imageUrl/sku/status/currency/pricing/profit/stock；详情需要来源或规格时再请求 sources。省略保持完整响应。"
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
    "description": "提交已有采集商品及明确 SKU 范围的最终商品内容；每个 importItem 用 _sourceSkuId 关联采购规格，Ozon 字段填写一次。提交后由程序统一审核并执行；无需审阅声明或机械幂等键。pending/unknown 只查询原操作，不重复提交。 现由统一经营变更审核执行；不要求检查声明或用户值证明。",
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
          "description": "可选旧记录字段；程序不要求值来源声明"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选旧调用幂等键；未提供时程序自动管理，未知结果只查询原操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选经营说明；无需重复记录授权原话"
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
      "required": [
        "storeId",
        "collectedItemId",
        "skuScope",
        "importItems"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 300000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "upstream_supported",
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
    "capabilityId": "hallmark.products.procurement",
    "version": "1.0.0",
    "title": "商品-采购对照表",
    "description": "同一店铺在售商品与精确采购来源对照。支持全量快照读取或搜索后分页，默认使用应用独立维护的经营规则，按实际卖家价与重量自动匹配物流费用并计算利润；重叠取总费用较高方案，缺失不按零计算。",
    "effect": "query",
    "aliases": [],
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "query": {
          "type": "string"
        },
        "cursor": {
          "type": "string",
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "loadAll": {
          "type": "boolean"
        },
        "planMode": {
          "enum": [
            "application",
            "delivery",
            "platform",
            "custom"
          ]
        },
        "deliveryMethodId": {
          "type": "string",
          "minLength": 1
        },
        "fixedFeeYuan": {
          "type": "number",
          "minimum": 0,
          "maximum": 1000000
        },
        "logisticsYuanPerKg": {
          "type": "number",
          "minimum": 0,
          "maximum": 100000
        },
        "commissionPercent": {
          "type": "number",
          "minimum": 0,
          "maximum": 99.9999
        },
        "forceRefresh": {
          "type": "boolean"
        }
      },
      "required": [
        "storeId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "products": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "productId": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "offerId": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "sku": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "title": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "imageUrl": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "currency": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "productUrl": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "salesSpecification": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "purchaseSpecification": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "purchaseLinks": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "url": {
                      "type": "string"
                    },
                    "label": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "url",
                    "label"
                  ],
                  "additionalProperties": false
                }
              },
              "purchaseMinor": {
                "type": [
                  "number",
                  "null"
                ]
              },
              "sellerMinor": {
                "type": [
                  "number",
                  "null"
                ]
              },
              "packageGrams": {
                "type": [
                  "number",
                  "null"
                ]
              },
              "referenceProfit": {
                "type": "object",
                "properties": {
                  "margin": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "profitMinor": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "logisticsMinor": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "commissionMinor": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "fixedMinor": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "reason": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "metricBasis": {
                    "type": "string"
                  },
                  "configRevision": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "planId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "selectionReason": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "margin",
                  "profitMinor",
                  "logisticsMinor",
                  "commissionMinor",
                  "fixedMinor",
                  "reason",
                  "metricBasis"
                ],
                "additionalProperties": false
              },
              "logisticsMatch": {
                "type": "object",
                "properties": {
                  "status": {
                    "enum": [
                      "unique",
                      "choice",
                      "unavailable",
                      "unknown"
                    ]
                  },
                  "candidatePlanIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "selectedPlanId": {
                    "type": "string"
                  },
                  "label": {
                    "type": "string"
                  },
                  "reason": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "status",
                  "candidatePlanIds",
                  "label",
                  "reason"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "productId",
              "offerId",
              "sku",
              "title",
              "imageUrl",
              "currency",
              "productUrl",
              "salesSpecification",
              "purchaseSpecification",
              "purchaseLinks",
              "purchaseMinor",
              "sellerMinor",
              "packageGrams",
              "referenceProfit",
              "logisticsMatch"
            ],
            "additionalProperties": false
          }
        },
        "total": {
          "type": "integer",
          "minimum": 0
        },
        "cursor": {
          "type": "string"
        },
        "dataTime": {
          "type": [
            "string",
            "null"
          ]
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "plan": {
          "type": "object",
          "properties": {
            "mode": {
              "enum": [
                "application",
                "delivery",
                "platform",
                "custom"
              ]
            },
            "label": {
              "type": "string"
            },
            "settingsRevision": {
              "type": [
                "integer",
                "null"
              ]
            },
            "fixedFeeYuan": {
              "type": [
                "number",
                "null"
              ]
            },
            "logisticsYuanPerKg": {
              "type": [
                "number",
                "null"
              ]
            },
            "commissionPercent": {
              "type": [
                "number",
                "null"
              ]
            },
            "reason": {
              "type": [
                "string",
                "null"
              ]
            },
            "deliveryMethodId": {
              "type": [
                "string",
                "null"
              ]
            },
            "choices": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "name": {
                    "type": "string"
                  },
                  "warehouseId": {
                    "type": "string"
                  },
                  "warehouseName": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "active": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "id",
                  "name",
                  "warehouseId",
                  "warehouseName",
                  "active"
                ],
                "additionalProperties": false
              }
            },
            "selectionNote": {
              "type": "string"
            }
          },
          "required": [
            "mode",
            "label",
            "settingsRevision",
            "fixedFeeYuan",
            "logisticsYuanPerKg",
            "commissionPercent",
            "reason",
            "deliveryMethodId",
            "choices",
            "selectionNote"
          ],
          "additionalProperties": false
        },
        "cache": {
          "type": "object",
          "properties": {
            "ttlMs": {
              "const": 900000
            },
            "fetchedAt": {
              "type": "string"
            },
            "expiresAt": {
              "type": "string"
            },
            "nextRefreshAt": {
              "type": "string"
            },
            "stale": {
              "type": "boolean"
            },
            "refreshing": {
              "type": "boolean"
            }
          },
          "required": [
            "ttlMs",
            "fetchedAt",
            "expiresAt",
            "nextRefreshAt",
            "stale"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "products",
        "total",
        "dataTime",
        "warnings",
        "plan",
        "cache"
      ],
      "additionalProperties": false
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
        "商品",
        "采购",
        "对照",
        "利润",
        "在售",
        "素材库"
      ]
    }
  },
  {
    "capabilityId": "hallmark.products.skus",
    "version": "1.0.0",
    "title": "商品 SKU 明细",
    "description": "按店铺及商品编号精确读取当前商品对应SKU的已有规格、售价与币种，不推测其他规格。",
    "effect": "query",
    "inputSchema": {
      "type": "object",
      "properties": {
        "storeId": {
          "type": "string",
          "minLength": 1
        },
        "productId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "storeId",
        "productId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "properties": {
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
        }
      },
      "required": [
        "items",
        "total"
      ],
      "additionalProperties": false
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
        "sku",
        "规格",
        "素材库"
      ]
    },
    "aliases": []
  },
  {
    "capabilityId": "hallmark.products.update_price",
    "version": "1.0.0",
    "title": "hallmark_update_price",
    "description": "修改明确商品清单的普通价格并只读核实；活动调价请使用经营草稿 promotion.update，并明确活动配额。省略 currency 时程序读取商品实际币种。提交后由程序统一审核并执行；无需审阅声明或机械幂等键。pending/unknown 只查询原操作，不重复提交。 现由统一经营变更审核执行；不要求检查声明或用户值证明。",
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
          "description": "可选旧记录字段；程序不要求值来源声明"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选旧调用幂等键；未提供时程序自动管理，未知结果只查询原操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选经营说明；无需重复记录授权原话"
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
      "required": [
        "storeId",
        "price"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 300000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "upstream_supported",
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
    "description": "修改明确商品清单在指定仓库的库存并只读核实。提交后由程序统一审核并执行；无需审阅声明或机械幂等键。pending/unknown 只查询原操作，不重复提交。 现由统一经营变更审核执行；不要求检查声明或用户值证明。",
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
          "description": "可选旧记录字段；程序不要求值来源声明"
        },
        "clientOperationKey": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选旧调用幂等键；未提供时程序自动管理，未知结果只查询原操作"
        },
        "userRequest": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000,
          "description": "可选经营说明；无需重复记录授权原话"
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
      "required": [
        "storeId",
        "stock",
        "warehouseId"
      ],
      "additionalProperties": false
    },
    "outputSchema": {
      "type": "object",
      "additionalProperties": true
    },
    "execution": {
      "mode": "async",
      "timeoutMs": 300000,
      "concurrency": "exclusive",
      "lockScope": "connection",
      "idempotency": "upstream_supported",
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
export type Input0 = { "mode": "new"; "viewId"?: string; "componentId"?: string; "revision"?: number; "workspacePath"?: string; "newCopy"?: boolean; "title"?: string; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "invocationId"?: string; "attemptId"?: string } | { "mode": "edit"; "viewId": string; "componentId"?: string; "revision"?: number; "workspacePath"?: string; "newCopy"?: boolean; "title"?: string; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "invocationId"?: string; "attemptId"?: string } | { "mode": "open_saved"; "viewId"?: string; "componentId": string; "revision"?: number; "workspacePath"?: string; "newCopy"?: boolean; "title"?: string; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "invocationId"?: string; "attemptId"?: string };
export type Output0 = { "draft": { "schemaVersion": 1; "draftId": string; "ownerSessionId": string; "viewId": string; "workspacePath": string; "sourceRevision": number; "epoch": number; "status": "editing" | "building" | "build_failed" | "previewing" | "preview_failed" | "publish_ready" | "mounting" | "mounted" | "failed_mount" | "cancelled" | "superseded" | "interrupted" | "closed" | "discarded"; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "selectedSourceRevision"?: number; "baseRevisionAtOpen"?: number }; "attempt": { "attemptId": string; "draftId": string; "epoch": number; "sourceRevision": number; "state": "editing" | "building" | "build_failed" | "previewing" | "preview_failed" | "publish_ready" | "mounting" | "mounted" | "failed_mount" | "cancelled" | "superseded" | "interrupted"; "startedAt": string; "expectedViewRevision": number; "invocationRefs": Array<string>; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }>; "terminalReason": string | null; "buildReceiptId"?: string; "previewReceiptId"?: string; "publicationId"?: string; "requestHash"?: string }; "view": ({ "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "viewRevision": number; "activeBuildId": string | null; "lastGoodBuildId": string | null; "previousGoodBuildId": string | null; "pendingPublicationId": string | null; "validationStatus": "draft_unpublished" | "legacy_unverified" | "verified" } & { [key: string]: JsonValue }) };
export function call0(client: AppsClient, ref: AppRef, input: Input0, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output0>> { return client.invoke(ref, catalog[0], input as JsonValue, options) as Promise<CapabilityResult<Output0>>; }

export type Input1 = { "attemptId": string; "expectedEpoch": number; "reason": string };
export type Output1 = { "status": "cancelled" | "already_published"; "activeBuildId": string | null; "viewRevision": number; "publication"?: { "publicationId": string; "viewId": string; "ownerSessionId": string; "attemptId": string; "attemptEpoch": number; "expectedViewRevision": number; "candidateBuildId": string; "priorActiveBuildId": string | null; "state": "prepared" | "mounting" | "mounted" | "failed_mount" | "cancelled" | "superseded" | "interrupted"; "readyDeadlineAt": string | null; "mountStartedAt"?: string | null; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }>; "createdAt": string; "updatedAt": string; "buildReceiptId": string; "previewReceiptId": string; "source": ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "frameInstanceId"?: string; "documentNonce"?: string; "committedViewRevision"?: number; "terminalReason"?: string } };
export function call1(client: AppsClient, ref: AppRef, input: Input1, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output1>> { return client.invoke(ref, catalog[1], input as JsonValue, options) as Promise<CapabilityResult<Output1>>; }

export type Input2 = { "attemptId": string; "displayId"?: string } | { "publicationId": string; "displayId"?: string };
export type Output2 = { "summary": { "lastConfirmedDisplay": ({  } & { [key: string]: JsonValue }) | null; "preparedBuild": ({  } & { [key: string]: JsonValue }) | null; "currentDisplay": ({  } & { [key: string]: JsonValue }) | null; "blockedStage": string; "nextAction": { "action": string; "reason": string; "target": ({  } & { [key: string]: JsonValue }); "errorCodes": Array<string> }; "requiresRebuild": boolean | null }; "draft": { "schemaVersion": 1; "draftId": string; "ownerSessionId": string; "viewId": string; "workspacePath": string; "sourceRevision": number; "epoch": number; "status": "editing" | "building" | "build_failed" | "previewing" | "preview_failed" | "publish_ready" | "mounting" | "mounted" | "failed_mount" | "cancelled" | "superseded" | "interrupted" | "closed" | "discarded"; "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "selectedSourceRevision"?: number; "baseRevisionAtOpen"?: number }; "attempt": { "attemptId": string; "draftId": string; "epoch": number; "sourceRevision": number; "state": "editing" | "building" | "build_failed" | "previewing" | "preview_failed" | "publish_ready" | "mounting" | "mounted" | "failed_mount" | "cancelled" | "superseded" | "interrupted"; "startedAt": string; "expectedViewRevision": number; "invocationRefs": Array<string>; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }>; "terminalReason": string | null; "buildReceiptId"?: string; "previewReceiptId"?: string; "publicationId"?: string; "requestHash"?: string }; "publication": { "publicationId": string; "viewId": string; "ownerSessionId": string; "attemptId": string; "attemptEpoch": number; "expectedViewRevision": number; "candidateBuildId": string; "priorActiveBuildId": string | null; "state": "prepared" | "mounting" | "mounted" | "failed_mount" | "cancelled" | "superseded" | "interrupted"; "readyDeadlineAt": string | null; "mountStartedAt"?: string | null; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }>; "createdAt": string; "updatedAt": string; "buildReceiptId": string; "previewReceiptId": string; "source": ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "frameInstanceId"?: string; "documentNonce"?: string; "committedViewRevision"?: number; "terminalReason"?: string } | null; "view": ({ "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "viewRevision": number; "activeBuildId": string | null; "lastGoodBuildId": string | null; "previousGoodBuildId": string | null; "pendingPublicationId": string | null; "validationStatus": "draft_unpublished" | "legacy_unverified" | "verified" } & { [key: string]: JsonValue }); "latestDisplay": { "displayId": string; "generation": number; "ownerSessionId": string; "viewId": string; "publicationId": string; "attemptId": string; "attemptEpoch": number; "buildId": string; "expectedViewRevision": number; "state": "opening" | "ready" | "failed" | "retired"; "view": ({ "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "viewRevision": number; "activeBuildId": string | null; "lastGoodBuildId": string | null; "previousGoodBuildId": string | null; "pendingPublicationId": string | null; "validationStatus": "draft_unpublished" | "legacy_unverified" | "verified" } & { [key: string]: JsonValue }); "errors": Array<{ "phase": string; "code": string; "message": string; "at"?: string }>; "createdAt": string; "updatedAt": string; "readyAt"?: string; "frameInstanceId"?: string; "documentNonce"?: string } | null; "displays": Array<{ "displayId": string; "generation": number; "ownerSessionId": string; "viewId": string; "publicationId": string; "attemptId": string; "attemptEpoch": number; "buildId": string; "expectedViewRevision": number; "state": "opening" | "ready" | "failed" | "retired"; "view": ({ "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "viewRevision": number; "activeBuildId": string | null; "lastGoodBuildId": string | null; "previousGoodBuildId": string | null; "pendingPublicationId": string | null; "validationStatus": "draft_unpublished" | "legacy_unverified" | "verified" } & { [key: string]: JsonValue }); "errors": Array<{ "phase": string; "code": string; "message": string; "at"?: string }>; "createdAt": string; "updatedAt": string; "readyAt"?: string; "frameInstanceId"?: string; "documentNonce"?: string }>; "display"?: { "displayId": string; "generation": number; "ownerSessionId": string; "viewId": string; "publicationId": string; "attemptId": string; "attemptEpoch": number; "buildId": string; "expectedViewRevision": number; "state": "opening" | "ready" | "failed" | "retired"; "view": ({ "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "createdAt": string; "updatedAt": string; "sourceComponentId"?: string; "baseRevision"?: number; "viewRevision": number; "activeBuildId": string | null; "lastGoodBuildId": string | null; "previousGoodBuildId": string | null; "pendingPublicationId": string | null; "validationStatus": "draft_unpublished" | "legacy_unverified" | "verified" } & { [key: string]: JsonValue }); "errors": Array<{ "phase": string; "code": string; "message": string; "at"?: string }>; "createdAt": string; "updatedAt": string; "readyAt"?: string; "frameInstanceId"?: string; "documentNonce"?: string }; "workspaceAvailable": boolean; "missingEvidence": Array<string> };
export function call2(client: AppsClient, ref: AppRef, input: Input2, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output2>> { return client.invoke(ref, catalog[2], input as JsonValue, options) as Promise<CapabilityResult<Output2>>; }

export type Input3 = { "attemptId": string; "epoch": number; "viewId": string; "expectedViewRevision": number; "buildId": string; "buildReceiptId": string; "previewReceiptId": string; "publicationId"?: string };
export type Output3 = { "publicationId": string; "viewId": string; "ownerSessionId": string; "attemptId": string; "attemptEpoch": number; "expectedViewRevision": number; "candidateBuildId": string; "priorActiveBuildId": string | null; "state": "prepared" | "mounting" | "mounted" | "failed_mount" | "cancelled" | "superseded" | "interrupted"; "readyDeadlineAt": string | null; "mountStartedAt"?: string | null; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }>; "createdAt": string; "updatedAt": string; "buildReceiptId": string; "previewReceiptId": string; "source": ({ "buildId": string; "directory": string; "entry": string; "files": Array<string> } & { [key: string]: JsonValue }); "frameInstanceId"?: string; "documentNonce"?: string; "committedViewRevision"?: number; "terminalReason"?: string };
export function call3(client: AppsClient, ref: AppRef, input: Input3, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output3>> { return client.invoke(ref, catalog[3], input as JsonValue, options) as Promise<CapabilityResult<Output3>>; }

export type Input4 = { "attemptId": string; "epoch": number; "reportRef": { "path": string; "sha256": string; "bytes": number } };
export type Output4 = { "schemaVersion": 1; "receiptId": string; "attemptId": string; "sourceRevision": number; "sourceInputDigest": string; "lockfileDigest": string; "command": Array<string>; "cwd": string; "toolchain": ({  } & { [key: string]: JsonValue }); "exitCode": 0; "startedAt": string; "finishedAt": string; "logRef": { "path": string; "sha256": string; "bytes": number }; "distDigest": string; "archiveBuildId": string; "fileManifestRef": { "path": string; "sha256": string; "bytes": number }; "inputUnchanged": true; "verdict": "PASS"; "executionKind"?: "executed" | "reuse"; "executionId"?: string; "reusedFrom"?: { "path": string; "sha256": string; "bytes": number }; "reuseVerifiedAt"?: string } | { "schemaVersion": 1; "receiptId": string; "attemptId": string; "sourceRevision": number; "sourceInputDigest": string; "lockfileDigest": string; "command": Array<string>; "cwd": string; "toolchain": ({  } & { [key: string]: JsonValue }); "exitCode": number; "startedAt": string; "finishedAt": string; "logRef": { "path": string; "sha256": string; "bytes": number }; "distDigest": string | null; "archiveBuildId": string | null; "fileManifestRef": { "path": string; "sha256": string; "bytes": number } | null; "inputUnchanged": boolean; "verdict": "FAIL"; "executionKind"?: "executed" | "reuse"; "executionId"?: string; "reusedFrom"?: { "path": string; "sha256": string; "bytes": number }; "reuseVerifiedAt"?: string };
export function call4(client: AppsClient, ref: AppRef, input: Input4, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output4>> { return client.invoke(ref, catalog[4], input as JsonValue, options) as Promise<CapabilityResult<Output4>>; }

export type Input5 = { "attemptId": string; "epoch": number; "buildReceiptId": string; "reportRef": { "path": string; "sha256": string; "bytes": number } };
export type Output5 = { "schemaVersion": 1; "receiptId": string; "attemptId": string; "buildReceiptId": string; "buildId": string; "protocol": "dsh.apps.component.v2"; "mode": "fixture" | "live_readonly"; "runnerVersion": string; "startedAt": string; "finishedAt": string; "viewportResults": Array<{ "id": string; "contentWidthCssPx": number; "heightCssPx": number; "deviceScaleFactor": number; "screenshot": { "path": string; "sha256": string; "bytes": number }; "pageErrors": Array<string>; "unhandledRejections": Array<string>; "failedRequests": Array<string>; "bridgeReady": true; "assertionIds": Array<string> }>; "assertionResults": Array<{ "id": string; "required": true; "expected": string; "actual": string | null; "status": "PASS"; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }> } | { "id": string; "required": false; "expected": string; "actual": string | null; "status": "PASS" | "FAIL" | "NOT_RUN" | "BLOCKED"; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }> }>; "verdict": "PASS" } | { "schemaVersion": 1; "receiptId": string; "attemptId": string; "buildReceiptId": string; "buildId": string; "protocol": "dsh.apps.component.v2"; "mode": "fixture" | "live_readonly"; "runnerVersion": string; "startedAt": string; "finishedAt": string; "viewportResults": Array<{ "id": string; "contentWidthCssPx": number; "heightCssPx": number; "deviceScaleFactor": number; "screenshot": { "path": string; "sha256": string; "bytes": number }; "pageErrors": Array<string>; "unhandledRejections": Array<string>; "failedRequests": Array<string>; "bridgeReady": boolean; "assertionIds": Array<string> }>; "assertionResults": Array<{ "id": string; "required": boolean; "expected": string; "actual": string | null; "status": "PASS" | "FAIL" | "NOT_RUN" | "BLOCKED"; "evidenceRefs": Array<{ "path": string; "sha256": string; "bytes": number }> }>; "verdict": "FAIL" | "INCOMPLETE" };
export function call5(client: AppsClient, ref: AppRef, input: Input5, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output5>> { return client.invoke(ref, catalog[5], input as JsonValue, options) as Promise<CapabilityResult<Output5>>; }

export type Input6 = { "viewId": string; "expectedViewRevision": number; "userRequest": string; "mode": "save_as"; "title"?: string } | { "viewId": string; "expectedViewRevision": number; "userRequest": string; "mode": "update"; "componentId": string; "expectedRevision": number; "title"?: string };
export type Output6 = ({ "componentId": string; "revision": number; "title": string; "view": ({  } & { [key: string]: JsonValue }); "userRequest": string; "savedAt": string } & { [key: string]: JsonValue });
export function call6(client: AppsClient, ref: AppRef, input: Input6, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output6>> { return client.invoke(ref, catalog[6], input as JsonValue, options) as Promise<CapabilityResult<Output6>>; }

export type Input7 = { "appId"?: string };
export type Output7 = { "sources": Array<{ "id": string; "title": string; "description"?: string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "storeScoped"?: boolean; "input": ({  } & { [key: string]: JsonValue }); "rowsPath": string; "parameters": Array<{ "name": string; "label": string; "type": "string" | "number" | "integer" | "boolean"; "required"?: boolean; "default"?: JsonValue; "linked"?: boolean; "editable"?: boolean; "choices"?: Array<{ "label": string; "value": string | number | boolean }> }>; "fields": Array<{ "key"?: string; "origin"?: { "source": string; "label": string }; "path": string; "role": string; "confirmed": boolean; "label"?: string; "description"?: string; "unit"?: string; "currency"?: string; "currencyPath"?: string; "percentScale"?: "fraction" | "whole"; "numericScale"?: number }>; "operations": { "pagination"?: { "cursorParam": string; "limitParam"?: string; "nextCursorPath"?: string; "totalPath"?: string }; "search": { "scope": "server" | "loaded"; "param"?: string }; "sort": { "scope": "server" | "loaded"; "param"?: string; "directionParam"?: string } }; "kind": "data_source"; "revision": number; "validation": { "status": "verified" | "failed" | "unverified"; "checkedAt": string; "invocationId"?: string; "sampleCount": number; "issues": Array<string>; "empty"?: boolean; "storeId"?: string } }> };
export function call7(client: AppsClient, ref: AppRef, input: Input7, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output7>> { return client.invoke(ref, catalog[7], input as JsonValue, options) as Promise<CapabilityResult<Output7>>; }

export type Input8 = {  };
export type Output8 = { "materials": Array<({  } & { [key: string]: JsonValue })>; "fieldRoles": Array<{ "key": string; "label": string; "description": string; "format": "text" | "currency" | "percent" | "integer" | "datetime" | "image"; "unit"?: string }> };
export function call8(client: AppsClient, ref: AppRef, input: Input8, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output8>> { return client.invoke(ref, catalog[8], input as JsonValue, options) as Promise<CapabilityResult<Output8>>; }

export type Input9 = {  };
export type Output9 = { "components": Array<{ "componentId": string; "revision": number; "title": string; "view": { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "panelState"?: "open" | "closed"; "closedAt"?: string; "sourceComponentId"?: string; "baseRevision"?: number; "baseRevisionAtOpen"?: number; "selectedSourceRevision"?: number; "viewRevision"?: number; "activeBuildId"?: string | null; "lastGoodBuildId"?: string | null; "previousGoodBuildId"?: string | null; "pendingPublicationId"?: string | null; "validationStatus"?: "draft_unpublished" | "legacy_unverified" | "verified" | "failed"; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> }; "userRequest": string; "savedAt": string; "legacyTemplate"?: JsonValue; "revisions"?: Array<{ "revision": number; "title": string; "savedAt": string; "buildId"?: string }> }>; "assets": Array<JsonValue | JsonValue | { "assetId": string; "kind": "template"; "title": string; "description"?: string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "userRequest": string; "savedAt"?: string }> };
export function call9(client: AppsClient, ref: AppRef, input: Input9, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output9>> { return client.invoke(ref, catalog[9], input as JsonValue, options) as Promise<CapabilityResult<Output9>>; }

export type Input10 = { "kind": "component" | "entry" | "template"; "id": string; "action": "rename" | "delete" | "pin" | "reorder"; "name"?: string; "order"?: number; "pinned"?: boolean; "expectedRevision"?: number };
export type Output10 = { "componentId": string; "revision": number; "title": string; "view": { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "panelState"?: "open" | "closed"; "closedAt"?: string; "sourceComponentId"?: string; "baseRevision"?: number; "baseRevisionAtOpen"?: number; "selectedSourceRevision"?: number; "viewRevision"?: number; "activeBuildId"?: string | null; "lastGoodBuildId"?: string | null; "previousGoodBuildId"?: string | null; "pendingPublicationId"?: string | null; "validationStatus"?: "draft_unpublished" | "legacy_unverified" | "verified" | "failed"; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> }; "userRequest": string; "savedAt": string; "legacyTemplate"?: JsonValue; "revisions"?: Array<{ "revision": number; "title": string; "savedAt": string; "buildId"?: string }> } | JsonValue | JsonValue | { "assetId": string; "kind": "template"; "title": string; "description"?: string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "userRequest": string; "savedAt"?: string } | { "deleted": true; "id": string };
export function call10(client: AppsClient, ref: AppRef, input: Input10, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output10>> { return client.invoke(ref, catalog[10], input as JsonValue, options) as Promise<CapabilityResult<Output10>>; }

export type Input11 = { "componentId": string; "revision"?: number; "directory"?: string; "context"?: { "storeId": string }; "newCopy"?: boolean };
export type Output11 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "panelState"?: "open" | "closed"; "closedAt"?: string; "sourceComponentId"?: string; "baseRevision"?: number; "baseRevisionAtOpen"?: number; "selectedSourceRevision"?: number; "viewRevision"?: number; "activeBuildId"?: string | null; "lastGoodBuildId"?: string | null; "previousGoodBuildId"?: string | null; "pendingPublicationId"?: string | null; "validationStatus"?: "draft_unpublished" | "legacy_unverified" | "verified" | "failed"; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call11(client: AppsClient, ref: AppRef, input: Input11, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output11>> { return client.invoke(ref, catalog[11], input as JsonValue, options) as Promise<CapabilityResult<Output11>>; }

export type Input12 = { "directory": string; "title"?: string; "viewId"?: string; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "legacyBindings"?: Array<{ "id": string; "datasetKey"?: string; "fieldMap": ({  } & { [key: string]: JsonValue }); "query"?: { "tool": string; "params": ({  } & { [key: string]: JsonValue }) } }> };
export type Output12 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "panelState"?: "open" | "closed"; "closedAt"?: string; "sourceComponentId"?: string; "baseRevision"?: number; "baseRevisionAtOpen"?: number; "selectedSourceRevision"?: number; "viewRevision"?: number; "activeBuildId"?: string | null; "lastGoodBuildId"?: string | null; "previousGoodBuildId"?: string | null; "pendingPublicationId"?: string | null; "validationStatus"?: "draft_unpublished" | "legacy_unverified" | "verified" | "failed"; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call12(client: AppsClient, ref: AppRef, input: Input12, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output12>> { return client.invoke(ref, catalog[12], input as JsonValue, options) as Promise<CapabilityResult<Output12>>; }

export type Input13 = { "definition": { "id": string; "title": string; "description"?: string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "storeScoped"?: boolean; "input": ({  } & { [key: string]: JsonValue }); "rowsPath": string; "parameters": Array<{ "name": string; "label": string; "type": "string" | "number" | "integer" | "boolean"; "required"?: boolean; "default"?: JsonValue; "linked"?: boolean; "editable"?: boolean; "choices"?: Array<{ "label": string; "value": string | number | boolean }> }>; "fields": Array<{ "key"?: string; "origin"?: { "source": string; "label": string }; "path": string; "role": string; "confirmed": boolean; "label"?: string; "description"?: string; "unit"?: string; "currency"?: string; "currencyPath"?: string; "percentScale"?: "fraction" | "whole"; "numericScale"?: number }>; "operations": { "pagination"?: { "cursorParam": string; "limitParam"?: string; "nextCursorPath"?: string; "totalPath"?: string }; "search": { "scope": "server" | "loaded"; "param"?: string }; "sort": { "scope": "server" | "loaded"; "param"?: string; "directionParam"?: string } } }; "expectedRevision"?: number; "context"?: { "storeId": string }; "params"?: ({  } & { [key: string]: JsonValue }) };
export type Output13 = { "id": string; "title": string; "description"?: string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "storeScoped"?: boolean; "input": ({  } & { [key: string]: JsonValue }); "rowsPath": string; "parameters": Array<{ "name": string; "label": string; "type": "string" | "number" | "integer" | "boolean"; "required"?: boolean; "default"?: JsonValue; "linked"?: boolean; "editable"?: boolean; "choices"?: Array<{ "label": string; "value": string | number | boolean }> }>; "fields": Array<{ "key"?: string; "origin"?: { "source": string; "label": string }; "path": string; "role": string; "confirmed": boolean; "label"?: string; "description"?: string; "unit"?: string; "currency"?: string; "currencyPath"?: string; "percentScale"?: "fraction" | "whole"; "numericScale"?: number }>; "operations": { "pagination"?: { "cursorParam": string; "limitParam"?: string; "nextCursorPath"?: string; "totalPath"?: string }; "search": { "scope": "server" | "loaded"; "param"?: string }; "sort": { "scope": "server" | "loaded"; "param"?: string; "directionParam"?: string } }; "kind": "data_source"; "revision": number; "validation": { "status": "verified" | "failed" | "unverified"; "checkedAt": string; "invocationId"?: string; "sampleCount": number; "issues": Array<string>; "empty"?: boolean; "storeId"?: string } };
export function call13(client: AppsClient, ref: AppRef, input: Input13, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output13>> { return client.invoke(ref, catalog[13], input as JsonValue, options) as Promise<CapabilityResult<Output13>>; }

export type Input14 = { "title": string; "design"?: JsonValue; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "viewId"?: string; "legacyViewId"?: string; "templateId"?: string; "directory"?: string; "legacyBindings"?: Array<{ "id": string; "datasetKey"?: string; "fieldMap": ({  } & { [key: string]: JsonValue }); "query"?: { "tool": string; "params": ({  } & { [key: string]: JsonValue }) } }>; "requiredBindingIds"?: Array<string>; "legacyNeedsSpecification"?: boolean };
export type Output14 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "panelState"?: "open" | "closed"; "closedAt"?: string; "sourceComponentId"?: string; "baseRevision"?: number; "baseRevisionAtOpen"?: number; "selectedSourceRevision"?: number; "viewRevision"?: number; "activeBuildId"?: string | null; "lastGoodBuildId"?: string | null; "previousGoodBuildId"?: string | null; "pendingPublicationId"?: string | null; "validationStatus"?: "draft_unpublished" | "legacy_unverified" | "verified" | "failed"; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call14(client: AppsClient, ref: AppRef, input: Input14, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output14>> { return client.invoke(ref, catalog[14], input as JsonValue, options) as Promise<CapabilityResult<Output14>>; }

export type Input15 = { "id": string; "revision": number; "bindingId": string; "context"?: { "storeId": string }; "params"?: ({  } & { [key: string]: JsonValue }) };
export type Output15 = { "binding": { "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }; "sourceRef": { "id": string; "revision": number; "params": ({  } & { [key: string]: JsonValue }) }; "fieldMap": ({  } & { [key: string]: JsonValue }); "fieldMeta": ({  } & { [key: string]: JsonValue }); "rowsPath": string };
export function call15(client: AppsClient, ref: AppRef, input: Input15, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output15>> { return client.invoke(ref, catalog[15], input as JsonValue, options) as Promise<CapabilityResult<Output15>>; }

export type Input16 = { "viewId": string; "userRequest": string; "title"?: string; "mode": "save_as" | "update"; "componentId"?: string; "expectedRevision"?: number; "legacyComponentId"?: string; "legacyTemplate"?: JsonValue };
export type Output16 = { "componentId": string; "revision": number; "title": string; "view": { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "panelState"?: "open" | "closed"; "closedAt"?: string; "sourceComponentId"?: string; "baseRevision"?: number; "baseRevisionAtOpen"?: number; "selectedSourceRevision"?: number; "viewRevision"?: number; "activeBuildId"?: string | null; "lastGoodBuildId"?: string | null; "previousGoodBuildId"?: string | null; "pendingPublicationId"?: string | null; "validationStatus"?: "draft_unpublished" | "legacy_unverified" | "verified" | "failed"; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> }; "userRequest": string; "savedAt": string; "legacyTemplate"?: JsonValue; "revisions"?: Array<{ "revision": number; "title": string; "savedAt": string; "buildId"?: string }> };
export function call16(client: AppsClient, ref: AppRef, input: Input16, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output16>> { return client.invoke(ref, catalog[16], input as JsonValue, options) as Promise<CapabilityResult<Output16>>; }

export type Input17 = { "title": string; "binding": { "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }; "legacyBinding"?: { "id": string; "datasetKey"?: string; "fieldMap": ({  } & { [key: string]: JsonValue }); "query"?: { "tool": string; "params": ({  } & { [key: string]: JsonValue }) } }; "legacyFieldOrder"?: Array<string>; "userRequest": string };
export type Output17 = JsonValue | JsonValue;
export function call17(client: AppsClient, ref: AppRef, input: Input17, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output17>> { return client.invoke(ref, catalog[17], input as JsonValue, options) as Promise<CapabilityResult<Output17>>; }

export type Input18 = { "viewId": string; "name": string; "description"?: string; "userRequest": string };
export type Output18 = { "assetId": string; "kind": "template"; "title": string; "description"?: string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "userRequest": string; "savedAt"?: string };
export function call18(client: AppsClient, ref: AppRef, input: Input18, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output18>> { return client.invoke(ref, catalog[18], input as JsonValue, options) as Promise<CapabilityResult<Output18>>; }

export type Input19 = { "viewId": string; "title"?: string; "design"?: JsonValue; "bindings"?: Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string } };
export type Output19 = { "viewId": string; "ownerSessionId": string | null; "title": string; "design": JsonValue; "bindings": Array<{ "bindingId": string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "input": JsonValue; "projection": Array<string>; "datasetId"?: string; "refresh": { "mode": "manual" | "scheduled"; "scheduleId"?: string } }>; "sourceRefs"?: ({  } & { [key: string]: JsonValue }); "context"?: { "storeId": string }; "source"?: { "buildId": string; "directory": string; "entry": string; "files": Array<string>; "thumbnail"?: string; "preview"?: { "screenshotPath": string; "reportPath": string; "width"?: number; "height"?: number; "capturedAt"?: string } }; "createdAt": string; "updatedAt": string; "panelState"?: "open" | "closed"; "closedAt"?: string; "sourceComponentId"?: string; "baseRevision"?: number; "baseRevisionAtOpen"?: number; "selectedSourceRevision"?: number; "viewRevision"?: number; "activeBuildId"?: string | null; "lastGoodBuildId"?: string | null; "previousGoodBuildId"?: string | null; "pendingPublicationId"?: string | null; "validationStatus"?: "draft_unpublished" | "legacy_unverified" | "verified" | "failed"; "initialData"?: Array<{ "bindingId": string; "datasetId": string; "status": "ready" | "failed" | "unavailable" | "empty" }> };
export function call19(client: AppsClient, ref: AppRef, input: Input19, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output19>> { return client.invoke(ref, catalog[19], input as JsonValue, options) as Promise<CapabilityResult<Output19>>; }

export type Input20 = { "definition": { "id": string; "title": string; "description"?: string; "appId": string; "connectionId": string; "capabilityId": string; "capabilityMajor": number; "storeScoped"?: boolean; "input": ({  } & { [key: string]: JsonValue }); "rowsPath": string; "parameters": Array<{ "name": string; "label": string; "type": "string" | "number" | "integer" | "boolean"; "required"?: boolean; "default"?: JsonValue; "linked"?: boolean; "editable"?: boolean; "choices"?: Array<{ "label": string; "value": string | number | boolean }> }>; "fields": Array<{ "key"?: string; "origin"?: { "source": string; "label": string }; "path": string; "role": string; "confirmed": boolean; "label"?: string; "description"?: string; "unit"?: string; "currency"?: string; "currencyPath"?: string; "percentScale"?: "fraction" | "whole"; "numericScale"?: number }>; "operations": { "pagination"?: { "cursorParam": string; "limitParam"?: string; "nextCursorPath"?: string; "totalPath"?: string }; "search": { "scope": "server" | "loaded"; "param"?: string }; "sort": { "scope": "server" | "loaded"; "param"?: string; "directionParam"?: string } } }; "expectedRevision"?: number; "context"?: { "storeId": string }; "params"?: ({  } & { [key: string]: JsonValue }) };
export type Output20 = { "status": "verified" | "failed" | "unverified"; "checkedAt": string; "invocationId"?: string; "sampleCount": number; "issues": Array<string>; "empty"?: boolean; "storeId"?: string };
export function call20(client: AppsClient, ref: AppRef, input: Input20, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output20>> { return client.invoke(ref, catalog[20], input as JsonValue, options) as Promise<CapabilityResult<Output20>>; }

export type Input21 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output21 = JsonValue | JsonValue;
export function call21(client: AppsClient, ref: AppRef, input: Input21, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output21>> { return client.invoke(ref, catalog[21], input as JsonValue, options) as Promise<CapabilityResult<Output21>>; }

export type Input22 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output22 = JsonValue | JsonValue;
export function call22(client: AppsClient, ref: AppRef, input: Input22, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output22>> { return client.invoke(ref, catalog[22], input as JsonValue, options) as Promise<CapabilityResult<Output22>>; }

export type Input23 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output23 = JsonValue | JsonValue;
export function call23(client: AppsClient, ref: AppRef, input: Input23, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output23>> { return client.invoke(ref, catalog[23], input as JsonValue, options) as Promise<CapabilityResult<Output23>>; }

export type Input24 = { "storeId"?: string; "store"?: string; "mode": "search" | "show" | "template" | "values" | "validate_value" | "sync"; "q"?: string; "descriptionCategoryId"?: string; "typeId"?: string; "attributeId"?: string; "valueId"?: string; "dictionaryId"?: string; "aspects"?: Array<string>; "requireAspects"?: boolean; "limit"?: number };
export type Output24 = JsonValue | JsonValue;
export function call24(client: AppsClient, ref: AppRef, input: Input24, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output24>> { return client.invoke(ref, catalog[24], input as JsonValue, options) as Promise<CapabilityResult<Output24>>; }

export type Input25 = { "itemId": string };
export type Output25 = JsonValue | JsonValue;
export function call25(client: AppsClient, ref: AppRef, input: Input25, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output25>> { return client.invoke(ref, catalog[25], input as JsonValue, options) as Promise<CapabilityResult<Output25>>; }

export type Input26 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output26 = JsonValue | JsonValue;
export function call26(client: AppsClient, ref: AppRef, input: Input26, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output26>> { return client.invoke(ref, catalog[26], input as JsonValue, options) as Promise<CapabilityResult<Output26>>; }

export type Input27 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output27 = JsonValue | JsonValue;
export function call27(client: AppsClient, ref: AppRef, input: Input27, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output27>> { return client.invoke(ref, catalog[27], input as JsonValue, options) as Promise<CapabilityResult<Output27>>; }

export type Input28 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output28 = JsonValue | JsonValue;
export function call28(client: AppsClient, ref: AppRef, input: Input28, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output28>> { return client.invoke(ref, catalog[28], input as JsonValue, options) as Promise<CapabilityResult<Output28>>; }

export type Input29 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output29 = JsonValue | JsonValue;
export function call29(client: AppsClient, ref: AppRef, input: Input29, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output29>> { return client.invoke(ref, catalog[29], input as JsonValue, options) as Promise<CapabilityResult<Output29>>; }

export type Input30 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output30 = JsonValue | JsonValue;
export function call30(client: AppsClient, ref: AppRef, input: Input30, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output30>> { return client.invoke(ref, catalog[30], input as JsonValue, options) as Promise<CapabilityResult<Output30>>; }

export type Input31 = { "storeId": string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "price": number; "currency"?: string; "oldPrice"?: number; "actionId"?: number };
export type Output31 = ({  } & { [key: string]: JsonValue });
export function call31(client: AppsClient, ref: AppRef, input: Input31, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output31>> { return client.invoke(ref, catalog[31], input as JsonValue, options) as Promise<CapabilityResult<Output31>>; }

export type Input32 = {  };
export type Output32 = JsonValue | JsonValue;
export function call32(client: AppsClient, ref: AppRef, input: Input32, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output32>> { return client.invoke(ref, catalog[32], input as JsonValue, options) as Promise<CapabilityResult<Output32>>; }

export type Input33 = {  };
export type Output33 = ({  } & { [key: string]: JsonValue });
export function call33(client: AppsClient, ref: AppRef, input: Input33, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output33>> { return client.invoke(ref, catalog[33], input as JsonValue, options) as Promise<CapabilityResult<Output33>>; }

export type Input34 = {  };
export type Output34 = Array<JsonValue | JsonValue | JsonValue>;
export function call34(client: AppsClient, ref: AppRef, input: Input34, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output34>> { return client.invoke(ref, catalog[34], input as JsonValue, options) as Promise<CapabilityResult<Output34>>; }

export type Input35 = {  };
export type Output35 = ({  } & { [key: string]: JsonValue });
export function call35(client: AppsClient, ref: AppRef, input: Input35, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output35>> { return client.invoke(ref, catalog[35], input as JsonValue, options) as Promise<CapabilityResult<Output35>>; }

export type Input36 = { "storeId"?: string; "store"?: string; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output36 = JsonValue | JsonValue;
export function call36(client: AppsClient, ref: AppRef, input: Input36, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output36>> { return client.invoke(ref, catalog[36], input as JsonValue, options) as Promise<CapabilityResult<Output36>>; }

export type Input37 = {  };
export type Output37 = ({ "appId": "hallmark"; "instructions": string; "tools": Array<{ "name": string; "kind": string }>; "boundaries": ({  } & { [key: string]: JsonValue }) } & { [key: string]: JsonValue });
export function call37(client: AppsClient, ref: AppRef, input: Input37, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output37>> { return client.invoke(ref, catalog[37], input as JsonValue, options) as Promise<CapabilityResult<Output37>>; }

export type Input38 = { "storeId"?: string; "store"?: string; "mode": "search" | "show" | "template" | "values" | "validate_value" | "sync"; "q"?: string; "descriptionCategoryId"?: string; "typeId"?: string; "attributeId"?: string; "valueId"?: string; "dictionaryId"?: string; "aspects"?: Array<string>; "requireAspects"?: boolean; "limit"?: number };
export type Output38 = JsonValue | JsonValue;
export function call38(client: AppsClient, ref: AppRef, input: Input38, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output38>> { return client.invoke(ref, catalog[38], input as JsonValue, options) as Promise<CapabilityResult<Output38>>; }

export type Input39 = { "itemId": string };
export type Output39 = JsonValue | JsonValue;
export function call39(client: AppsClient, ref: AppRef, input: Input39, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output39>> { return client.invoke(ref, catalog[39], input as JsonValue, options) as Promise<CapabilityResult<Output39>>; }

export type Input40 = { "cursor"?: string; "limit"?: number; "query"?: string };
export type Output40 = ({ "datasetKey": string; "items": Array<({  } & { [key: string]: JsonValue })>; "total": number; "cursor"?: string } & { [key: string]: JsonValue }) | ({ "datasetKey": string; "spill": ({ "path": string; "bytes": number; "summary": ({  } & { [key: string]: JsonValue }); "cursor": string } & { [key: string]: JsonValue }); "total": number; "cursor": string; "limit": number } & { [key: string]: JsonValue });
export function call40(client: AppsClient, ref: AppRef, input: Input40, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output40>> { return client.invoke(ref, catalog[40], input as JsonValue, options) as Promise<CapabilityResult<Output40>>; }

export type Input41 = { "itemId": string };
export type Output41 = { "items": Array<({  } & { [key: string]: JsonValue })>; "total": number };
export function call41(client: AppsClient, ref: AppRef, input: Input41, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output41>> { return client.invoke(ref, catalog[41], input as JsonValue, options) as Promise<CapabilityResult<Output41>>; }

export type Input42 = { "id"?: string; "ids"?: Array<string>; "skuIds"?: Array<string>; "selections"?: Array<{ "id": string; "skuIds"?: Array<string>; "cursor"?: string; "revision"?: string }>; "cursor"?: string; "revision"?: string; "limit"?: number; "maxBytes"?: number; "refresh"?: boolean };
export type Output42 = ({  } & { [key: string]: JsonValue });
export function call42(client: AppsClient, ref: AppRef, input: Input42, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output42>> { return client.invoke(ref, catalog[42], input as JsonValue, options) as Promise<CapabilityResult<Output42>>; }

export type Input43 = { "id": string; "kind"?: "raw" | "description" | "images" | "image"; "path"?: string; "assetId"?: string; "role"?: "main" | "sku" | "detail"; "skuIds"?: Array<string>; "cursor"?: string; "revision"?: string; "limit"?: number; "maxBytes"?: number };
export type Output43 = ({  } & { [key: string]: JsonValue });
export function call43(client: AppsClient, ref: AppRef, input: Input43, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output43>> { return client.invoke(ref, catalog[43], input as JsonValue, options) as Promise<CapabilityResult<Output43>>; }

export type Input44 = { "query"?: string; "source"?: string; "category"?: string; "price"?: { "meaning": "purchase_cost" | "source_display_price"; "currency": string; "min"?: number; "max"?: number }; "store"?: { "id": string; "listingRecord"?: "found" | "not_found" | "unavailable"; "status"?: "listed" | "partial" | "not_listed" | "unknown"; "saleState"?: "on_sale" | "out_of_stock" | "pending" | "archived" | "failed" | "not_sellable" | "unknown"; "association"?: "linked" | "none" | "unknown" }; "limit"?: number; "cursor"?: string; "refresh"?: boolean };
export type Output44 = ({  } & { [key: string]: JsonValue });
export function call44(client: AppsClient, ref: AppRef, input: Input44, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output44>> { return client.invoke(ref, catalog[44], input as JsonValue, options) as Promise<CapabilityResult<Output44>>; }

export type Input45 = { "datasetKey"?: string; "storeId"?: string; "store"?: string };
export type Output45 = ({ "datasetKey": string; "snapshot": ({  } & { [key: string]: JsonValue }); "counts": ({  } & { [key: string]: JsonValue }) } & { [key: string]: JsonValue });
export function call45(client: AppsClient, ref: AppRef, input: Input45, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output45>> { return client.invoke(ref, catalog[45], input as JsonValue, options) as Promise<CapabilityResult<Output45>>; }

export type Input46 = { "datasetKey"?: string; "storeId"?: string; "store"?: string };
export type Output46 = ({ "datasetKey": string; "state": string; "lastSuccessAt": string | null; "lastError": JsonValue } & { [key: string]: JsonValue });
export function call46(client: AppsClient, ref: AppRef, input: Input46, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output46>> { return client.invoke(ref, catalog[46], input as JsonValue, options) as Promise<CapabilityResult<Output46>>; }

export type Input47 = { "files": Array<{ "path": string; "skuIds"?: Array<string> }> };
export type Output47 = ({  } & { [key: string]: JsonValue });
export function call47(client: AppsClient, ref: AppRef, input: Input47, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output47>> { return client.invoke(ref, catalog[47], input as JsonValue, options) as Promise<CapabilityResult<Output47>>; }

export type Input48 = { "storeId": string; "title"?: string; "rows": Array<{ "rowId"?: string; "action": "price" | "stock" | "archive" | "promotion.enroll" | "promotion.update" | "promotion.exit" | "listing"; "target": { "offerId": string; "productId"?: string | number; "sku"?: string | number }; "payload": ({  } & { [key: string]: JsonValue }); "procurement"?: Array<{ "itemId": string; "sourceSkuId": string; "quantity": number }>; "referenceSubjects"?: Array<{ "sourceImageUrl": string; "subject": string }>; "pricing"?: { "planId"?: string; "mode": "automatic" | "manual" }; "dependsOn"?: Array<string> }> };
export type Output48 = ({  } & { [key: string]: JsonValue });
export function call48(client: AppsClient, ref: AppRef, input: Input48, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output48>> { return client.invoke(ref, catalog[48], input as JsonValue, options) as Promise<CapabilityResult<Output48>>; }

export type Input49 = JsonValue | JsonValue;
export type Output49 = ({  } & { [key: string]: JsonValue });
export function call49(client: AppsClient, ref: AppRef, input: Input49, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output49>> { return client.invoke(ref, catalog[49], input as JsonValue, options) as Promise<CapabilityResult<Output49>>; }

export type Input50 = { "planId": string; "expectedRevision": number; "rows": Array<{ "rowId"?: string; "action": "price" | "stock" | "archive" | "promotion.enroll" | "promotion.update" | "promotion.exit" | "listing"; "target": { "offerId": string; "productId"?: string | number; "sku"?: string | number }; "payload": ({  } & { [key: string]: JsonValue }); "procurement"?: Array<{ "itemId": string; "sourceSkuId": string; "quantity": number }>; "referenceSubjects"?: Array<{ "sourceImageUrl": string; "subject": string }>; "pricing"?: { "planId"?: string; "mode": "automatic" | "manual" }; "dependsOn"?: Array<string> }> };
export type Output50 = ({  } & { [key: string]: JsonValue });
export function call50(client: AppsClient, ref: AppRef, input: Input50, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output50>> { return client.invoke(ref, catalog[50], input as JsonValue, options) as Promise<CapabilityResult<Output50>>; }

export type Input51 = { "planId": string; "expectedRevision": number };
export type Output51 = ({  } & { [key: string]: JsonValue });
export function call51(client: AppsClient, ref: AppRef, input: Input51, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output51>> { return client.invoke(ref, catalog[51], input as JsonValue, options) as Promise<CapabilityResult<Output51>>; }

export type Input52 = JsonValue | JsonValue;
export type Output52 = ({  } & { [key: string]: JsonValue });
export function call52(client: AppsClient, ref: AppRef, input: Input52, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output52>> { return client.invoke(ref, catalog[52], input as JsonValue, options) as Promise<CapabilityResult<Output52>>; }

export type Input53 = { "operationId": string };
export type Output53 = ({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue }) | ({ "planId": string; "storeId": string; "status": string; "revision": number; "rows": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue });
export function call53(client: AppsClient, ref: AppRef, input: Input53, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output53>> { return client.invoke(ref, catalog[53], input as JsonValue, options) as Promise<CapabilityResult<Output53>>; }

export type Input54 = { "storeId"?: string; "since"?: string; "limit"?: number };
export type Output54 = Array<({ "operationId": string; "kind": string; "storeId": string; "state": "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown"; "targets": Array<string>; "input": ({  } & { [key: string]: JsonValue }); "items": Array<({  } & { [key: string]: JsonValue })> } & { [key: string]: JsonValue })>;
export function call54(client: AppsClient, ref: AppRef, input: Input54, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output54>> { return client.invoke(ref, catalog[54], input as JsonValue, options) as Promise<CapabilityResult<Output54>>; }

export type Input55 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "dateFrom": string; "dateTo": string; "groupBy"?: "day" | "sku" };
export type Output55 = { "items": Array<{ "sku": string | null; "title": string | null; "date": string | null; "impressions": number | null; "views": number | null; "cartEvents": number | null; "orderedUnits": number | null; "visitors": number | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call55(client: AppsClient, ref: AppRef, input: Input55, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output55>> { return client.invoke(ref, catalog[55], input as JsonValue, options) as Promise<CapabilityResult<Output55>>; }

export type Input56 = { "storeId": string; "recipe": { "version": 1; "grain": "product" | "posting"; "fields": Array<"products.productId" | "products.offerId" | "products.sku" | "products.title" | "products.image" | "products.status" | "products.statusCode" | "products.statusRaw" | "products.errorReason" | "prices.productId" | "prices.offerId" | "prices.price" | "prices.ordinaryPrice" | "prices.oldPrice" | "prices.currency" | "warehouses.warehouseId" | "warehouses.warehouseName" | "warehouses.fulfillment" | "warehouses.status" | "warehouses.statusCode" | "warehouses.statusRaw" | "warehouses.deliveryMethods" | "stocks.productId" | "stocks.sku" | "stocks.offerId" | "stocks.warehouseId" | "stocks.warehouseName" | "stocks.stockPresent" | "stocks.stockReserved" | "stocks.stockAvailable" | "analytics.sku" | "analytics.title" | "analytics.date" | "analytics.impressions" | "analytics.views" | "analytics.cartEvents" | "analytics.orderedUnits" | "analytics.visitors" | "orders.orderId" | "orders.orderNumber" | "orders.postingNumber" | "orders.sku" | "orders.offerId" | "orders.title" | "orders.quantity" | "orders.orderPrice" | "orders.currency" | "orders.status" | "orders.statusCode" | "orders.statusRaw" | "orders.createdAt" | "orders.shipmentAt" | "orders.trackingNumber" | "weights.postingNumber" | "weights.sku" | "weights.offerId" | "weights.quantity" | "weights.actualWeight" | "weights.declaredWeight" | "weights.weightDifference" | "weights.weightScope" | "weights.shipmentAt" | "finance.accrualId" | "finance.unitNumber" | "finance.postingNumber" | "finance.date" | "finance.accrualType" | "finance.amount" | "finance.commission" | "finance.logisticsFee" | "finance.feeDetails" | "finance.currency" | "promotions.actionId" | "promotions.actionName" | "promotions.productId" | "promotions.participation" | "promotions.actionPrice" | "promotions.maxActionPrice" | "promotions.currency" | "promotions.startsAt" | "promotions.endsAt" | "returns.returnId" | "returns.postingNumber" | "returns.orderId" | "returns.orderNumber" | "returns.sku" | "returns.offerId" | "returns.title" | "returns.quantity" | "returns.returnReason" | "returns.status" | "returns.statusCode" | "returns.statusRaw" | "returns.createdAt" | "returns.orderPrice" | "returns.currency"> }; "dateFrom"?: string; "dateTo"?: string; "warehouseId"?: string; "actionId"?: string; "participation"?: "joined" | "eligible"; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean };
export type Output56 = { "items": Array<{ "products"?: { "productId": string | null; "offerId": string | null; "sku": string | null; "title": string | null; "image": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "errorReason": string | null }; "prices"?: { "productId": string | null; "offerId": string | null; "price": number | null; "ordinaryPrice": number | null; "oldPrice": number | null; "currency": string | null }; "warehouses"?: { "warehouseId": string | null; "warehouseName": string | null; "fulfillment": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "deliveryMethods": string | null }; "stocks"?: { "productId": string | null; "sku": string | null; "offerId": string | null; "warehouseId": string | null; "warehouseName": string | null; "stockPresent": number | null; "stockReserved": number | null; "stockAvailable": number | null }; "analytics"?: { "sku": string | null; "title": string | null; "date": string | null; "impressions": number | null; "views": number | null; "cartEvents": number | null; "orderedUnits": number | null; "visitors": number | null }; "orders"?: { "orderId": string | null; "orderNumber": string | null; "postingNumber": string | null; "sku": string | null; "offerId": string | null; "title": string | null; "quantity": number | null; "orderPrice": number | null; "currency": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "createdAt": string | null; "shipmentAt": string | null; "trackingNumber": string | null }; "weights"?: { "postingNumber": string | null; "sku": string | null; "offerId": string | null; "quantity": number | null; "actualWeight": number | null; "declaredWeight": number | null; "weightDifference": number | null; "weightScope": string | null; "shipmentAt": string | null }; "finance"?: { "accrualId": string | null; "unitNumber": string | null; "postingNumber": string | null; "date": string | null; "accrualType": string | null; "amount": number | null; "commission": number | null; "logisticsFee": number | null; "feeDetails": string | null; "currency": string | null }; "promotions"?: { "actionId": string | null; "actionName": string | null; "productId": string | null; "participation": string | null; "actionPrice": number | null; "maxActionPrice": number | null; "currency": string | null; "startsAt": string | null; "endsAt": string | null }; "returns"?: { "returnId": string | null; "postingNumber": string | null; "orderId": string | null; "orderNumber": string | null; "sku": string | null; "offerId": string | null; "title": string | null; "quantity": number | null; "returnReason": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "createdAt": string | null; "orderPrice": number | null; "currency": string | null } }>; "cursor"?: string; "total": number; "dataTime": string | null; "warnings": Array<string>; "sourceStates": Array<{ "source": string; "status": "ready" | "empty" | "missing"; "rowCount": number; "pageCount": number; "dataTime": string | null; "fetchedAt": string | null; "cacheHit": boolean; "freshness": "fresh" | "stale"; "cacheReason": "none" | "ttl" | "rate_limit" | "upstream_unavailable" | "refresh_due"; "nextRetryAt"?: string }>; "cache": { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean }; "fieldMeta": Array<{ "key": string; "source": string; "label": string; "description": string; "format": string; "currencyPath"?: string; "unit"?: string }>; "period"?: { "dateFrom": string; "dateTo": string } };
export function call56(client: AppsClient, ref: AppRef, input: Input56, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output56>> { return client.invoke(ref, catalog[56], input as JsonValue, options) as Promise<CapabilityResult<Output56>>; }

export type Input57 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "dateFrom": string; "dateTo": string };
export type Output57 = { "items": Array<{ "accrualId": string | null; "unitNumber": string | null; "postingNumber": string | null; "date": string | null; "accrualType": string | null; "amount": number | null; "commission": number | null; "logisticsFee": number | null; "feeDetails": string | null; "currency": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call57(client: AppsClient, ref: AppRef, input: Input57, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output57>> { return client.invoke(ref, catalog[57], input as JsonValue, options) as Promise<CapabilityResult<Output57>>; }

export type Input58 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "dateFrom": string; "dateTo": string; "postingNumber"?: string; "status"?: string };
export type Output58 = { "items": Array<{ "orderId": string | null; "orderNumber": string | null; "postingNumber": string | null; "sku": string | null; "offerId": string | null; "title": string | null; "quantity": number | null; "orderPrice": number | null; "currency": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "createdAt": string | null; "shipmentAt": string | null; "trackingNumber": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call58(client: AppsClient, ref: AppRef, input: Input58, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output58>> { return client.invoke(ref, catalog[58], input as JsonValue, options) as Promise<CapabilityResult<Output58>>; }

export type Input59 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "productId"?: string };
export type Output59 = { "items": Array<{ "productId": string | null; "offerId": string | null; "price": number | null; "ordinaryPrice": number | null; "oldPrice": number | null; "currency": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call59(client: AppsClient, ref: AppRef, input: Input59, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output59>> { return client.invoke(ref, catalog[59], input as JsonValue, options) as Promise<CapabilityResult<Output59>>; }

export type Input60 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "productId"?: string; "sku"?: string };
export type Output60 = { "items": Array<{ "productId": string | null; "offerId": string | null; "sku": string | null; "title": string | null; "image": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "errorReason": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call60(client: AppsClient, ref: AppRef, input: Input60, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output60>> { return client.invoke(ref, catalog[60], input as JsonValue, options) as Promise<CapabilityResult<Output60>>; }

export type Input61 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "actionId"?: string; "participation"?: "joined" | "eligible" };
export type Output61 = { "items": Array<{ "actionId": string | null; "actionName": string | null; "productId": string | null; "participation": string | null; "actionPrice": number | null; "maxActionPrice": number | null; "currency": string | null; "startsAt": string | null; "endsAt": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call61(client: AppsClient, ref: AppRef, input: Input61, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output61>> { return client.invoke(ref, catalog[61], input as JsonValue, options) as Promise<CapabilityResult<Output61>>; }

export type Input62 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "sku"?: string };
export type Output62 = { "items": Array<{ "productId": string | null; "offerId": string | null; "sku": string | null; "title": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "rating": number | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call62(client: AppsClient, ref: AppRef, input: Input62, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output62>> { return client.invoke(ref, catalog[62], input as JsonValue, options) as Promise<CapabilityResult<Output62>>; }

export type Input63 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "returnId"?: string };
export type Output63 = { "items": Array<{ "returnId": string | null; "postingNumber": string | null; "orderId": string | null; "orderNumber": string | null; "sku": string | null; "offerId": string | null; "title": string | null; "quantity": number | null; "returnReason": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "createdAt": string | null; "orderPrice": number | null; "currency": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call63(client: AppsClient, ref: AppRef, input: Input63, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output63>> { return client.invoke(ref, catalog[63], input as JsonValue, options) as Promise<CapabilityResult<Output63>>; }

export type Input64 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "sku"?: string; "warehouseId"?: string };
export type Output64 = { "items": Array<{ "productId": string | null; "sku": string | null; "offerId": string | null; "warehouseId": string | null; "warehouseName": string | null; "stockPresent": number | null; "stockReserved": number | null; "stockAvailable": number | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call64(client: AppsClient, ref: AppRef, input: Input64, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output64>> { return client.invoke(ref, catalog[64], input as JsonValue, options) as Promise<CapabilityResult<Output64>>; }

export type Input65 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "warehouseId"?: string };
export type Output65 = { "items": Array<{ "warehouseId": string | null; "warehouseName": string | null; "fulfillment": string | null; "status": string | null; "statusCode": string | null; "statusRaw": string | null; "deliveryMethods": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call65(client: AppsClient, ref: AppRef, input: Input65, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output65>> { return client.invoke(ref, catalog[65], input as JsonValue, options) as Promise<CapabilityResult<Output65>>; }

export type Input66 = { "storeId": string; "limit"?: number; "cursor"?: string; "loadAll"?: boolean; "forceRefresh"?: boolean; "dateFrom": string; "dateTo": string };
export type Output66 = { "items": Array<{ "postingNumber": string | null; "sku": string | null; "offerId": string | null; "quantity": number | null; "actualWeight": number | null; "declaredWeight": number | null; "weightDifference": number | null; "weightScope": string | null; "shipmentAt": string | null }>; "cursor"?: string; "total"?: number; "dataTime": string | null; "period"?: { "dateFrom": string; "dateTo": string }; "warnings": Array<string>; "cache"?: { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call66(client: AppsClient, ref: AppRef, input: Input66, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output66>> { return client.invoke(ref, catalog[66], input as JsonValue, options) as Promise<CapabilityResult<Output66>>; }

export type Input67 = { "storeId": string; "title"?: string; "rows": Array<{ "rowId"?: string; "action": "price" | "stock" | "archive" | "promotion.enroll" | "promotion.update" | "promotion.exit" | "listing"; "target": { "offerId": string; "productId"?: string | number; "sku"?: string | number }; "payload": ({  } & { [key: string]: JsonValue }); "procurement"?: Array<{ "itemId": string; "sourceSkuId": string; "quantity": number }>; "referenceSubjects"?: Array<{ "sourceImageUrl": string; "subject": string }>; "pricing"?: { "planId"?: string; "mode": "automatic" | "manual" }; "dependsOn"?: Array<string> }> };
export type Output67 = ({  } & { [key: string]: JsonValue });
export function call67(client: AppsClient, ref: AppRef, input: Input67, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output67>> { return client.invoke(ref, catalog[67], input as JsonValue, options) as Promise<CapabilityResult<Output67>>; }

export type Input68 = JsonValue | JsonValue;
export type Output68 = ({  } & { [key: string]: JsonValue });
export function call68(client: AppsClient, ref: AppRef, input: Input68, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output68>> { return client.invoke(ref, catalog[68], input as JsonValue, options) as Promise<CapabilityResult<Output68>>; }

export type Input69 = { "planId": string };
export type Output69 = ({  } & { [key: string]: JsonValue });
export function call69(client: AppsClient, ref: AppRef, input: Input69, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output69>> { return client.invoke(ref, catalog[69], input as JsonValue, options) as Promise<CapabilityResult<Output69>>; }

export type Input70 = { "storeId"?: string };
export type Output70 = ({  } & { [key: string]: JsonValue });
export function call70(client: AppsClient, ref: AppRef, input: Input70, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output70>> { return client.invoke(ref, catalog[70], input as JsonValue, options) as Promise<CapabilityResult<Output70>>; }

export type Input71 = { "planId": string; "rowIds"?: Array<string> };
export type Output71 = ({  } & { [key: string]: JsonValue });
export function call71(client: AppsClient, ref: AppRef, input: Input71, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output71>> { return client.invoke(ref, catalog[71], input as JsonValue, options) as Promise<CapabilityResult<Output71>>; }

export type Input72 = { "planId": string; "expectedRevision": number; "rows": Array<{ "rowId"?: string; "action": "price" | "stock" | "archive" | "promotion.enroll" | "promotion.update" | "promotion.exit" | "listing"; "target": { "offerId": string; "productId"?: string | number; "sku"?: string | number }; "payload": ({  } & { [key: string]: JsonValue }); "procurement"?: Array<{ "itemId": string; "sourceSkuId": string; "quantity": number }>; "referenceSubjects"?: Array<{ "sourceImageUrl": string; "subject": string }>; "pricing"?: { "planId"?: string; "mode": "automatic" | "manual" }; "dependsOn"?: Array<string> }> };
export type Output72 = ({  } & { [key: string]: JsonValue });
export function call72(client: AppsClient, ref: AppRef, input: Input72, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output72>> { return client.invoke(ref, catalog[72], input as JsonValue, options) as Promise<CapabilityResult<Output72>>; }

export type Input73 = { "planId": string; "expectedRevision": number };
export type Output73 = ({  } & { [key: string]: JsonValue });
export function call73(client: AppsClient, ref: AppRef, input: Input73, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output73>> { return client.invoke(ref, catalog[73], input as JsonValue, options) as Promise<CapabilityResult<Output73>>; }

export type Input74 = { "storeId"?: string; "store"?: string; "path": string; "method"?: "GET" | "POST"; "body"?: ({  } & { [key: string]: JsonValue }) };
export type Output74 = JsonValue | JsonValue;
export function call74(client: AppsClient, ref: AppRef, input: Input74, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output74>> { return client.invoke(ref, catalog[74], input as JsonValue, options) as Promise<CapabilityResult<Output74>>; }

export type Input75 = { "storeId": string; "row": { "rowId"?: string; "action": "price" | "stock" | "archive" | "promotion.enroll" | "promotion.update" | "promotion.exit" | "listing"; "target": { "offerId": string; "productId"?: string | number; "sku"?: string | number }; "payload": ({  } & { [key: string]: JsonValue }); "procurement"?: Array<{ "itemId": string; "sourceSkuId": string; "quantity": number }>; "referenceSubjects"?: Array<{ "sourceImageUrl": string; "subject": string }>; "pricing"?: { "planId"?: string; "mode": "automatic" | "manual" }; "dependsOn"?: Array<string> } };
export type Output75 = ({  } & { [key: string]: JsonValue });
export function call75(client: AppsClient, ref: AppRef, input: Input75, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output75>> { return client.invoke(ref, catalog[75], input as JsonValue, options) as Promise<CapabilityResult<Output75>>; }

export type Input76 = { "storeId": string };
export type Output76 = ({  } & { [key: string]: JsonValue });
export function call76(client: AppsClient, ref: AppRef, input: Input76, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output76>> { return client.invoke(ref, catalog[76], input as JsonValue, options) as Promise<CapabilityResult<Output76>>; }

export type Input77 = { "storeId"?: string; "store"?: string; "minMargin"?: number; "maxMargin"?: number; "minPrice"?: number; "maxPrice"?: number; "minStock"?: number; "maxStock"?: number; "status"?: string; "resultSetId"?: string };
export type Output77 = ({ "resultSetId": string; "storeId": string; "expiresAt": string; "payload": JsonValue | JsonValue } & { [key: string]: JsonValue });
export function call77(client: AppsClient, ref: AppRef, input: Input77, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output77>> { return client.invoke(ref, catalog[77], input as JsonValue, options) as Promise<CapabilityResult<Output77>>; }

export type Input78 = { "storeId"?: string; "store"?: string; "cursor"?: string; "limit"?: number; "query"?: string; "status"?: string; "fields"?: Array<"title" | "imageUrl" | "sku" | "status" | "platformStatus" | "currency" | "price" | "pricing" | "profit" | "stock" | "metrics" | "sources" | "declaredWeight" | "storeName"> };
export type Output78 = ({ "products": Array<({  } & { [key: string]: JsonValue })>; "total": number } & { [key: string]: JsonValue }) | ({ "spill": ({ "path": string; "bytes": number; "summary": ({  } & { [key: string]: JsonValue }); "cursor": string } & { [key: string]: JsonValue }); "storeId": string; "total": number } & { [key: string]: JsonValue });
export function call78(client: AppsClient, ref: AppRef, input: Input78, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output78>> { return client.invoke(ref, catalog[78], input as JsonValue, options) as Promise<CapabilityResult<Output78>>; }

export type Input79 = { "storeId": string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "collectedItemId": string; "skuScope": Array<string>; "importItems": Array<({  } & { [key: string]: JsonValue })> };
export type Output79 = ({  } & { [key: string]: JsonValue });
export function call79(client: AppsClient, ref: AppRef, input: Input79, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output79>> { return client.invoke(ref, catalog[79], input as JsonValue, options) as Promise<CapabilityResult<Output79>>; }

export type Input80 = { "storeId": string; "query"?: string; "cursor"?: string; "limit"?: number; "loadAll"?: boolean; "planMode"?: "application" | "delivery" | "platform" | "custom"; "deliveryMethodId"?: string; "fixedFeeYuan"?: number; "logisticsYuanPerKg"?: number; "commissionPercent"?: number; "forceRefresh"?: boolean };
export type Output80 = { "products": Array<{ "productId": string | null; "offerId": string | null; "sku": string | null; "title": string | null; "imageUrl": string | null; "currency": string | null; "productUrl": string | null; "salesSpecification": string | null; "purchaseSpecification": string | null; "purchaseLinks": Array<{ "url": string; "label": string }>; "purchaseMinor": number | null; "sellerMinor": number | null; "packageGrams": number | null; "referenceProfit": { "margin": number | null; "profitMinor": number | null; "logisticsMinor": number | null; "commissionMinor": number | null; "fixedMinor": number | null; "reason": string | null; "metricBasis": string; "configRevision"?: number | null; "planId"?: string | null; "selectionReason"?: string | null }; "logisticsMatch": { "status": "unique" | "choice" | "unavailable" | "unknown"; "candidatePlanIds": Array<string>; "selectedPlanId"?: string; "label": string; "reason": string | null } }>; "total": number; "cursor"?: string; "dataTime": string | null; "warnings": Array<string>; "plan": { "mode": "application" | "delivery" | "platform" | "custom"; "label": string; "settingsRevision": number | null; "fixedFeeYuan": number | null; "logisticsYuanPerKg": number | null; "commissionPercent": number | null; "reason": string | null; "deliveryMethodId": string | null; "choices": Array<{ "id": string; "name": string; "warehouseId": string; "warehouseName": string | null; "active": boolean }>; "selectionNote": string }; "cache": { "ttlMs": 900000; "fetchedAt": string; "expiresAt": string; "nextRefreshAt": string; "stale": boolean; "refreshing"?: boolean } };
export function call80(client: AppsClient, ref: AppRef, input: Input80, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output80>> { return client.invoke(ref, catalog[80], input as JsonValue, options) as Promise<CapabilityResult<Output80>>; }

export type Input81 = { "storeId": string; "productId": string };
export type Output81 = { "items": Array<({  } & { [key: string]: JsonValue })>; "total": number };
export function call81(client: AppsClient, ref: AppRef, input: Input81, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output81>> { return client.invoke(ref, catalog[81], input as JsonValue, options) as Promise<CapabilityResult<Output81>>; }

export type Input82 = { "storeId": string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "price": number; "currency"?: string; "oldPrice"?: number; "actionId"?: number };
export type Output82 = ({  } & { [key: string]: JsonValue });
export function call82(client: AppsClient, ref: AppRef, input: Input82, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output82>> { return client.invoke(ref, catalog[82], input as JsonValue, options) as Promise<CapabilityResult<Output82>>; }

export type Input83 = { "storeId": string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string>; "valueSource"?: string; "clientOperationKey"?: string; "userRequest"?: string; "scopeConfirmed"?: boolean; "stock": number; "warehouseId": string };
export type Output83 = ({  } & { [key: string]: JsonValue });
export function call83(client: AppsClient, ref: AppRef, input: Input83, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output83>> { return client.invoke(ref, catalog[83], input as JsonValue, options) as Promise<CapabilityResult<Output83>>; }

export type Input84 = { "storeId"?: string; "store"?: string; "offerIds"?: Array<string>; "productIds"?: Array<string> };
export type Output84 = ({ "products": Array<({  } & { [key: string]: JsonValue })>; "total": number } & { [key: string]: JsonValue }) | ({ "spill": ({ "path": string; "bytes": number; "summary": ({  } & { [key: string]: JsonValue }); "cursor": string } & { [key: string]: JsonValue }); "storeId": string; "total": number } & { [key: string]: JsonValue });
export function call84(client: AppsClient, ref: AppRef, input: Input84, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output84>> { return client.invoke(ref, catalog[84], input as JsonValue, options) as Promise<CapabilityResult<Output84>>; }

export type Input85 = {  };
export type Output85 = Array<JsonValue | JsonValue | JsonValue>;
export function call85(client: AppsClient, ref: AppRef, input: Input85, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output85>> { return client.invoke(ref, catalog[85], input as JsonValue, options) as Promise<CapabilityResult<Output85>>; }

export type Input86 = { "query": string };
export type Output86 = JsonValue | JsonValue | JsonValue;
export function call86(client: AppsClient, ref: AppRef, input: Input86, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output86>> { return client.invoke(ref, catalog[86], input as JsonValue, options) as Promise<CapabilityResult<Output86>>; }

export type Input87 = { "id"?: string; "title": string; "content": string };
export type Output87 = { "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } };
export function call87(client: AppsClient, ref: AppRef, input: Input87, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output87>> { return client.invoke(ref, catalog[87], input as JsonValue, options) as Promise<CapabilityResult<Output87>>; }

export type Input88 = { "id": string };
export type Output88 = { "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } };
export function call88(client: AppsClient, ref: AppRef, input: Input88, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output88>> { return client.invoke(ref, catalog[88], input as JsonValue, options) as Promise<CapabilityResult<Output88>>; }

export type Input89 = { "query"?: string; "cursor"?: string; "limit"?: number };
export type Output89 = { "items": Array<{ "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } }>; "total": number; "returned": number; "nextCursor": string | null; "completeness": "complete" | "partial" };
export function call89(client: AppsClient, ref: AppRef, input: Input89, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output89>> { return client.invoke(ref, catalog[89], input as JsonValue, options) as Promise<CapabilityResult<Output89>>; }

export type Input90 = JsonValue | JsonValue;
export type Output90 = { "note": { "id": string; "title": string; "content": string; "revision": string; "createdAt": string; "updatedAt": string }; "resource": { "appId": "notes"; "connectionId": string; "resourceType": "note"; "resourceId": string; "revision": string } };
export function call90(client: AppsClient, ref: AppRef, input: Input90, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output90>> { return client.invoke(ref, catalog[90], input as JsonValue, options) as Promise<CapabilityResult<Output90>>; }
