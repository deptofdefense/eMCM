document.addEventListener('DOMContentLoaded', function() {
	var EDITOR_CONFIG = {
		value: PARTS ? PARTS[0].content : 'Loading...',
		language: 'html',
		folding: true,
		formatOnPaste: true,
		renderIndentGuides: true,
		renderLineHighlight: 'all',
		lineHeight: 22,
		scrollBeyondLastLine: false,
		useTabStops: true,
		wrappingColumn: 0,
		wordWrap: true,
		wrappingIndent: 'same'
	}

	var PARTS, KEYED_PARTS, CHANGED_PARTS = {}
	var selectedPart

	loadEditor()
	loadGitHub()

	window.onhashchange = function() {
		var href = location.hash
		var part = KEYED_PARTS[href.substr(1)]
		selectPart(part || PARTS[0])
	}

	window.onbeforeunload = function() {
		if (Object.keys(CHANGED_PARTS).length > 0) {
			return "You have unsaved changes. If you leave this page, your changes will be lost. Are you sure you want to leave the editor?"
		}
	}

	var editor
	function loadEditor() {
		require.config({paths: {'vs': 'vs'}})
		require(['vs/editor/editor.main'], function() {
			editor = monaco.editor.create(document.getElementById('editor'), EDITOR_CONFIG)

			editor.onDidChangeModelContent(debounce(onChange, 300))

			window.addEventListener('resize', debounce(resize, 100))

			if (PARTS) {
				window.onhashchange()
			}
		})
	}

	var GitHub, REPO
	function loadGitHub() {
		if (!localStorage.githubUsername || !localStorage.githubToken) {
			localStorage.githubUsername = prompt("What's your GitHub username?") || ""
			localStorage.githubToken = prompt("What's your GitHub Personal Access Token?") || ""
		}

		if (!localStorage.githubUsername || !localStorage.githubToken) {
			return
		}

		require(['js/github'], function(gh) {
			GitHub = new gh({
				username: localStorage.githubUsername,
				token: localStorage.githubToken,
			})

			REPO = GitHub.getRepo('deptofdefense', 'mcm')
			REPO.getContents('master', 'manual', false, function(err, contents) {
				if (err) {
					return alert(err)
				}

				forEach(contents, function(blob) {
					if (blob.name === 'toc.json') {
						var sha = blob.sha

						REPO.getBlob(sha, function(err, contents) {
							if (err) {
								return alert(err)
							}

							loadToc(contents)
						})
					}
				})
			})
		})
	}

	var toc = document.getElementById('toc')

	function loadToc(json) {
		// fetch('toc.json', function(json) {
			// PARTS = JSON.parse(json)
			PARTS = json
			KEYED_PARTS = arrayToHash(PARTS, 'children')

			forEach(PARTS, function(part, i) {
				makeTocItem(part, i)
			})

			if (editor) {
				window.onhashchange()
			}
		// })
	}

	toc.addEventListener('click', function(event) {
		var target = event.target
		if (target.tagName !== 'A') {
			return
		}

		var href = target.getAttribute('href')
		if (href === '#') {
			target.parentNode.classList.toggle('expanded')
			event.stopPropagation()
			event.preventDefault()
		}
	})

	var tocProto = document.getElementById('toc-proto')
	toc.removeChild(tocProto)

	function makeTocItem(part, i, parent) {
		if (!parent) {
			parent = toc
		}

		var li = tocProto.cloneNode(true)
		li.removeAttribute('id')
		part.navItem = li

		var a = li.querySelector('a')
		a.innerHTML = titleForSection(part)
		parent.appendChild(li)

		if (part.children) {
			li.classList.add('has-children')
			a.setAttribute('href', '#')

			var ul = document.createElement('ul')
			li.appendChild(ul)

			forEach(part.children, function (child, i) {
				makeTocItem(child, i, ul)
			})
		} else {
			a.setAttribute('href', '#' + part.id)
		}
	}

	function selectPart(part) {
		if (selectedPart) {
			if (!IS_REVIEWING) {
				selectedPart.newValue = editor.getValue()
			}

			selectedPart.navItem.classList.remove('selected')
		}

		selectedPart = part

		if (selectedPart) {
			selectedPart.navItem.classList.add('selected')
			updatePreview()

			if (IS_REVIEWING) {
				diffEditor.setModel({
					original: monaco.editor.createModel(selectedPart.content, 'html'),
					modified: monaco.editor.createModel(selectedPart.newValue, 'html'),
				})
				diffEditor.layout()
			} else {
				editor.setValue(selectedPart.newValue || selectedPart.content)
				editor.layout()
			}

			if (location.hash !== '#' + selectedPart.id) {
				location.hash = '#' + selectedPart.id
			}
		}
	}

	var previewFrame = document.getElementById('preview')
	function updatePreview() {
		var body = previewFrame.contentWindow.document.getElementById('content')
		body.innerHTML = headerForSection(selectedPart)
		body.innerHTML += contentize(editor.getValue())
		fixListElements(body)
	}

	function onChange() {
		var id = selectedPart.id
		if (!CHANGED_PARTS[id]) {
			CHANGED_PARTS[id] = selectedPart
		}

		updatePreview()
	}

	var reviewToc = document.getElementById('review-toc')
	var reviewChanges = document.getElementById('review-button')
	var cancelReviewChanges = document.getElementById('cancel-review-button')
	var editModeButtons = document.getElementById('edit-mode-buttons')
	var reviewModeButtons = document.getElementById('review-mode-buttons')

	reviewModeButtons.style.display = 'none'

	var diffEditor

	var IS_REVIEWING

	reviewChanges.addEventListener('click', function() {
		if (selectedPart) {
			selectedPart.newValue = editor.getValue()
		}

		reviewToc.innerHTML = ''
		toc.style.display = 'none'

		editModeButtons.style.display = 'none'
		reviewModeButtons.style.display = 'block'

		editor.domElement.style.display = 'none'
		previewFrame.parentNode.style.display = 'none'

		if (diffEditor) {
			document.getElementById('diff').style.display = 'block'
		} else {
			diffEditor = monaco.editor.createDiffEditor(document.getElementById('diff'), EDITOR_CONFIG)
		}

		var first
		Object.forEach(KEYED_PARTS, function(key, part) {
			if (CHANGED_PARTS[key] && part.newValue && part.newValue !== part.content) {
				if (!first) { first = part }
				var newNavItem = part.navItem.cloneNode(true)
				part.oldNavItem = part.navItem
				part.navItem = newNavItem
				reviewToc.appendChild(newNavItem)
			}
		})

		IS_REVIEWING = true

		if (first) {
			selectPart(first)
		}
	})

	cancelReviewChanges.addEventListener('click', function() {
		Object.forEach(CHANGED_PARTS, function(key, part) {
			if (part.oldNavItem) {
				part.navItem = part.oldNavItem
				part.oldNavItem = null
			}
		})

		reviewToc.innerHTML = ''
		toc.style.display = 'block'

		editModeButtons.style.display = 'block'
		reviewModeButtons.style.display = 'none'

		document.getElementById('diff').style.display = 'none'
		editor.domElement.style.display = 'block'
		previewFrame.parentNode.style.display = 'block'

		IS_REVIEWING = false

		selectPart(selectedPart)
	})

	var saveChanges = document.getElementById('save-draft-button')
	saveChanges.addEventListener('click', function() {
		var branchName = prompt("What should this branch be called?")
		REPO.createBranch('master', branchName, function(err, branch) {
			if (err) {
				return alert(err)
			}

			var tree = []
			Object.forEach(CHANGED_PARTS, function(key, part) {
				tree.push({
					mode: '100644',
					path: 'manual/' + part.path,
					type: 'blob',
					content: part.newValue
				})
			})

			REPO.createTree(tree, branch.ref, function(err, tree) {
				if (err) {
					return alert(err)
				}

				REPO.commit(branch.object.sha, tree.sha, "Editor commit", function(err, commit) {
					REPO.updateHead(branch.ref.substr(5), commit.sha, false, function(err, head) {
						window.open('https://github.com/deptofdefense/mcm/compare/' + branchName)
					})
				})
			})
		})
	})

	function resize() {
		if (IS_REVIEWING) {
			diffEditor.layout()
		} else {
			editor.layout()
		}
	}
})