$(function() {
	var navItemProto = document.querySelector('[data-nav-proto]')
	var subNavProto = document.querySelector('[data-subnav-proto]')
	var content = document.querySelector('[data-content]')

	var navContainer = navItemProto.parentNode
	navContainer.removeChild(navItemProto)
	subNavProto.parentNode.removeChild(subNavProto)

	fetch('/toc.json', function(json) {
		window.MCM = JSON.parse(json)

		var timeout = 0
		forEachRecursive(MCM, function(section, chain) {
			var title = titleForSection(section)
			var id = parameterize(idForChain(chain))

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

			var contentDiv = renderContentDiv(id)

			contentDiv.innerHTML = headerForSection(section)

			if (section.content) {
				setTimeout(function() {
					contentDiv.innerHTML += contentize(section.content)
					fixListElements(contentDiv)
				}, timeout)

				timeout += 100
			}
		})

		$('body').scrollspy({
			target: '[data-toc]'
		})
	})

	function idForChain(chain) {
		var id = chain.map(function(section) {
			return section.type + '-' + (section.index || section._i)
		}).join('_')
		return parameterize(id)
	}

	var ROMAN_TITLE_TYPES = {
		'part': ' - ',
		'chapter': '. '
	}

	function titleForSection(section) {
		var romanSeparator = ROMAN_TITLE_TYPES[section.type]
		if (romanSeparator && section.index) {
			return romanize(section.index) + romanSeparator + section.title
		}

		if (section.type === 'rule') {
			return section.index + '. ' + section.title
		}

		return section.title
	}

	function headerForSection(section) {
		var result
		var id = parseInt(section.index)
		if (section.type === 'part') {
			result = "<h1 style='text-align: center'>"
			if (id) result += "PART " + romanize(id) + "<br>"
			result += section.title.toUpperCase()
			result += "</h1>"
		} else if (section.type === 'chapter') {
			result = "<h2 style='text-align: center'>"
			result += "CHAPTER " + romanize(id) + ". " + section.title.toUpperCase()
			result += "</h2>"
		} else if (section.type === 'rule') {
			result = "<h3>Rule " + id + ". " + section.title
		} else {
			result = "<h3>" + section.title + "</h3>"
		}
		return result
	}

	function renderContentDiv(key) {
		var el = document.createElement('div')
		el.id = key
		content.appendChild(el)
		return el
	}

	function renderNavItem(title, href) {
		var item = navItemProto.cloneNode(true)
		item.querySelector('[data-title]').innerHTML = title
		item.querySelector('[data-target]').href = '#' + href
		return item
	}

	function fetch(url, callback) {
		var request = new XMLHttpRequest()
		request.addEventListener('load', function() {callback(this.responseText)})
		request.open('GET', url)
		request.send()
	}

	function parameterize(string) {
		return string.trim().replace(/[\s|-]+/g, '-').split(/[^\w|-]/)[0].toLowerCase()
	}

	function contentize(html) {
		return html.replace(/<(\/?)list/g, '<$1ol')
	}

	var LIST_TYPES = {
		'I': /I/,
		'i': /i/,
		'A': /[A-Z]/,
		'a': /[a-z]/,
		'1': /[0-9]/,
	}

	function fixListElements(el) {
		var lists = el.querySelectorAll('ol')
		lists && lists.forEach(function(list) {
			var li = list.querySelector('li')
			var index = li.getAttribute('index')
			for (var listType in LIST_TYPES) {
				if (LIST_TYPES[listType].test(index)) {
					list.type = listType
					break
				}
			}
		})
	}

	function romanizeTitle(title) {
		var comps = title.split(' - ')
		if (comps.length > 1) {
			var romanized = [romanize(comps[0])]
			if (!romanized[0]) romanized.pop()
				
			romanized.push(comps[1])
			return romanized.join(' - ')
		} else { return comps[0] }
	}

	function romanize(num) {
		var lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}, roman = '', i
		for (i in lookup) {
			while (num >= lookup[i]) {
				roman += i
				num -= lookup[i]
			}
		}
		
		return roman
	}

	function forEachRecursive(array, func, chain) {
		if (!chain) chain = []

		array.forEach(function(object, i) {
			object._i = i
			var newChain = chain.concat(object)
			func(object, newChain)
			if (object.children) {
				forEachRecursive(object.children, func, newChain)
			}
		})
	}
})