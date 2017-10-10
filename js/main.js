/*
This software project was created in 2017 by the U.S. Federal government.
See INTENT.md for information about what that means. See CONTRIBUTORS.md and
LICENSE.md for licensing, copyright, and attribution information.

Copyright (C) 2017 U.S. Federal Government (in countries where recognized)
Copyright (C) 2017 <Contributor Names>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
$(function() {
	var navItemProto = document.querySelector('[data-nav-proto]')
	var subNavProto = document.querySelector('[data-subnav-proto]')
	var content = document.querySelector('[data-content]')

	var navContainer = navItemProto.parentNode
	navContainer.removeChild(navItemProto)
	subNavProto.parentNode.removeChild(subNavProto)

	var searchIndex = elasticlunr(function() {
		this.addField('_title', {boost: 5})
		this.addField('content')
		this.setRef('arrayIndex')
		this.saveDocument(false)
	})
	window.searchIndex = searchIndex

	fetch('toc.c7619ba.json', function(json) {
		window.MCM = JSON.parse(json)
		window.MCMflat = flattenArray(MCM, 'children')

		forEachRecursive(MCM, function(section, chain) {
			var title = section._title = titleForSection(section)
			var id = section._id = idForChain(chain)

			if (chain.length > 1) var parent = chain[chain.length - 2]

			if (chain.length < 4) {
				section.navItem = renderNavItem(title, id)
				if (parent) {
					if (!parent.subNav) {
						parent.subNav = subNavProto.cloneNode(true)
						parent.navItem.appendChild(parent.subNav)
					}

					parent.subNav.appendChild(section.navItem)
				} else {
					navContainer.appendChild(section.navItem)
				}
			}

			section.node = renderContentDiv(id)
		})

		renderViewableRangeForSection(MCMflat[0])

		$('body').scrollspy({
			target: '[data-toc]',
			offset: 180
		})

		var scroller = new FastScroll()
		scroller.on('scroll:progress', function(event) {
			if (scroller.directionY < 0) {
				var index = MCMflat.indexOf(firstRenderedSection)
				var firstNode = firstRenderedSection.node
				if (index > 0 && scroller.y < firstNode.offsetTop + firstNode.offsetHeight) {
					firstRenderedSection = MCMflat[index - 1]
					var newNode = renderSection(firstRenderedSection)
					document.body.scrollTop += newNode.offsetHeight
				}
			} else {
				var index = MCMflat.indexOf(lastRenderedSection)
				if (index < MCMflat.length - 1 && scroller.y + window.innerHeight > lastRenderedSection.node.offsetTop) {
					lastRenderedSection = MCMflat[index + 1]
					renderSection(lastRenderedSection)
				}
			}
		})

		window.onhashchange = function(event) {
			if (event) {
				event.preventDefault()
				event.stopPropagation()
			}

			// clear search results if we have any
			if (cachedContent) {
				searchBar.value = ''
				performSearch()
			}

			var hash = location.hash.substr(1)
			var prefix = hash.match(HASH_PREFIX_REGEXP)
			if (prefix) {
				var fullHash = hash
				hash = prefix[1]
			}

			for (var i = 0, count = MCMflat.length; i < count; i++) {
				var section = MCMflat[i]
				if (section._id === hash) {
					renderViewableRangeForSection(section, false)
					if (fullHash) {
						setTimeout(function() {
							var targetElement = document.getElementById(fullHash)
							if (targetElement) {
								targetElement.scrollIntoView(true)
								document.body.scrollTop -= 160
							}
						})
					}

					return
				}
			}
		}

		if (location.hash.length > 1) {
			window.onhashchange()
		}

		setTimeout(function() {
			forEach(MCMflat, function(section, i) {
				if (section.content) {
					section.arrayIndex = i
					searchIndex.addDoc(section)
				}
			})
		}, 100)
	})

	document.getElementById('searchbar').addEventListener('input', performSearch)

	function renderSection(section, contentDiv) {
		contentDiv = contentDiv || section.node
		if (!contentDiv.firstChild) {
			contentDiv.innerHTML = headerForSection(section)

			if (section.content) {
				contentDiv.innerHTML += contentize(section.content)
				fixListElements(contentDiv)
				fixDiscussionElements(contentDiv)
				fixTableElements(contentDiv)
			}
		}

		return contentDiv
	}

	var firstRenderedSection
	var lastRenderedSection

	function renderViewableRangeForSection(section, jumpTo) {
		var index = MCMflat.indexOf(section)
		if (index > 0) {
			firstRenderedSection = MCMflat[index - 1]
			renderSection(firstRenderedSection)
		} else {
			firstRenderedSection = section
		}

		var lastNode = renderSection(section)
		if (jumpTo !== false) {
			setTimeout(function(lastNode) {
				document.body.scrollTop = lastNode.offsetTop - 80
			}.bind(null, lastNode))
		}

		lastRenderedSection = section

		while (index < MCMflat.length - 1 && (
				document.body.scrollTop + window.innerHeight > lastNode.offsetTop ||
				lastNode.offsetHeight < 150
			)) {
				lastRenderedSection = MCMflat[++index]
				lastNode = renderSection(lastRenderedSection)
			}

		$('body').scrollspy('refresh')
	}

	function renderContentDiv(key) {
		var row = document.createElement('div')
		row.className = 'row'
		row.id = key

		var col = document.createElement('div')
		col.className = 'col-xs-12 col-sm-10'
		row.appendChild(col)
		content.appendChild(row)

		return col
	}

	function renderNavItem(title, href) {
		var item = navItemProto.cloneNode(true)
		item.querySelector('[data-title]').innerHTML = title
		item.querySelector('[data-target]').href = '#' + href
		return item
	}

	var searchBar = document.getElementById('searchbar')
	var noResults = document.querySelector('[data-no-results]')

	var RULE_REGEXP = /^([rea])(\d+)(\w*)/i
	var RULE_PART_REGEXP = /([\d|[a-z]|[A-Z]]+)/g
	var RULE_CODES = {r: 'rcm', e: 'milrevid', a: 'art'}

	var cachedContent
	function performSearch() {
		var query = searchBar.value

		var ruleMatch = query.match(RULE_REGEXP)
		if (ruleMatch) {
			query = null

			var hash = [RULE_CODES[ruleMatch[1].toLowerCase()], ruleMatch[2]]
			if (ruleMatch[3]) {
				var partMatches = ruleMatch[3].match(RULE_PART_REGEXP)
				hash = hash.concat(partMatches)
			}

			location.hash = hash.join('-')
			searchBar.focus()
		}

		if (!query && cachedContent) {
			content.innerHTML = ''
			content.appendChild(cachedContent)
			content = cachedContent
			cachedContent = null
		} else if (query) {
			var results = searchIndex.search(query)
				.filter(function(result){
					var a = document.createElement('div');
					a.innerHTML = MCMflat[result.ref].content
					return a.textContent.search(query) > 0
				})
				.sort().map(function(result) { return MCMflat[result.ref] })
			var hrefs = results.map(function(result) { return '#' + result._id })
		}

		if (query && !cachedContent) {
			cachedContent = content
			content = content.parentNode
			content.removeChild(cachedContent)
		} else if (results) {
			content.innerHTML = ""
		}

		noResults.style.display = query && !results.length ? 'block' : 'none'

		forEach(document.querySelectorAll('.toc .nav li a'), function(a) {
			var isVisible = !query || hrefs.indexOf(a.getAttribute('href')) !== -1
			a.parentNode.style.display = isVisible ? 'block' : 'none'
			if (isVisible && query) {
				while (a = a.parentNode) {
					if (a.nodeName === 'UL' || a.nodeName === 'LI')
						a.style.display = 'block'
				}
			}
		})

		// render highlighted results
		if (results && results.length) {
			forEach(results, function(section) {
				var index = section.content.indexOf(query)
				if (index === -1)
					return

				var node = document.createElement('div')
				node.className = 'search-result'
				node.innerHTML += headerForSection(section)
				node.addEventListener('click', function() {
					location.hash = section._id
				})

				var html = ''
				if (index > 50) {
					var lastTagIndex = section.content.lastIndexOf('>', index - 50) + 1
					html += section.content.substr(lastTagIndex, index - lastTagIndex)
				} else {
					html += section.content.substr(Math.max(index - 200, 0), 200)
				}

				html += "<span class=\"highlight\">" + query + "</span>"

				var nextTagIndex = section.content.indexOf('<', index + query.length + 50)
				if (nextTagIndex) {
					html += section.content.substr(index + query.length, nextTagIndex - (index + query.length))
				} else {
					html += section.content.substr(index + query.length, 200)
				}

				node.innerHTML += contentize(html)

				content.appendChild(node)
			})

			document.body.scrollTop = 0
		}
	}
})
